#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const ENV_PATH = path.join(ROOT, ".env.local");
const DEFAULT_FILES = [
  "/Users/francesconigro/Desktop/farfalle-prenotazioni.json",
];
const KEY = "lfb_bookings";
const ALLOWED_LODGES = new Set(["Limone", "Macaone", "Vanessa", "Aurora"]);

function readEnv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    env[key] = value;
  }
  return env;
}

function normalizeChannel(value, fallbackText = "") {
  const raw = `${value ?? ""}`.trim().toLowerCase();
  const haystack = `${raw} ${fallbackText}`.toLowerCase();
  if (haystack.includes("airbnb")) return "airbnb";
  if (haystack.includes("booking")) return "booking";
  if (haystack.includes("expedia")) return "expedia";
  if (haystack.includes("direct") || haystack.includes("dirett")) return "direct";
  if (haystack.includes("other")) return "other";
  return "direct";
}

function normalizeStatus(value) {
  const raw = `${value ?? ""}`.trim().toLowerCase();
  if (raw === "option" || raw === "blocked" || raw === "cancelled") return raw;
  return "confirmed";
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeBooking(row) {
  const id = `${row.id ?? ""}`.trim();
  const guestName = `${row.guestName ?? ""}`.trim();
  const lodge = `${row.lodge ?? row.room ?? ""}`.trim();
  const checkIn = `${row.checkIn ?? ""}`.trim();
  const checkOut = `${row.checkOut ?? ""}`.trim();
  const notes = `${row.notes ?? ""}`.trim();

  if (!id || !guestName || !lodge || !checkIn || !checkOut) {
    throw new Error("campi obbligatori mancanti");
  }
  if (!ALLOWED_LODGES.has(lodge)) {
    throw new Error(`lodge non valida: ${lodge}`);
  }

  const now = new Date().toISOString();
  const fallbackText = `${row.source ?? ""} ${notes}`;
  const channel = normalizeChannel(row.channel, fallbackText);

  return {
    id,
    guestName,
    lodge,
    checkIn,
    checkOut,
    status: normalizeStatus(row.status),
    channel,
    notes,
    guestsCount: Math.max(1, toNumber(row.guestsCount ?? row.adults, 2)),
    totalAmount: toNumber(row.totalAmount ?? row.grossEarnings, 0),
    depositAmount: toNumber(row.depositAmount ?? row.deposit, 0),
    depositReceived: Boolean(row.depositReceived),
    checkInTime: row.checkInTime ? `${row.checkInTime}` : undefined,
    checkOutTime: row.checkOutTime ? `${row.checkOutTime}` : undefined,
    breakfastIncluded: typeof row.breakfastIncluded === "boolean"
      ? row.breakfastIncluded
      : typeof row.breakfast === "boolean"
        ? row.breakfast
        : undefined,
    childrenCount: Number.isFinite(row.childrenCount)
      ? Number(row.childrenCount)
      : Number.isFinite(row.children)
        ? Number(row.children)
        : undefined,
    createdAt: row.createdAt ? `${row.createdAt}` : now,
    updatedAt: now,
    dataOrigin: "import_json",
  };
}

function updatedMs(row) {
  const ts = Date.parse(row.updatedAt ?? row.createdAt ?? "");
  return Number.isFinite(ts) ? ts : 0;
}

async function readKv(base, token) {
  const res = await fetch(`${base}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.result) return { v: 0, ts: "", data: [] };
  const parsed = JSON.parse(json.result);
  if (Array.isArray(parsed)) {
    return { v: 1, ts: new Date().toISOString(), data: parsed };
  }
  return parsed;
}

async function writeKv(base, token, payload) {
  const res = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["SET", KEY, JSON.stringify(payload)]]),
  });
  if (!res.ok) {
    throw new Error(`scrittura KV fallita: HTTP ${res.status}`);
  }
}

function loadRows(files) {
  const normalized = [];
  const report = [];

  for (const file of files) {
    if (!fs.existsSync(file)) {
      report.push(`SKIP file mancante: ${file}`);
      continue;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : parsed.bookings;
    if (!Array.isArray(rows)) {
      report.push(`SKIP formato non valido: ${file}`);
      continue;
    }
    for (const row of rows) {
      try {
        normalized.push(normalizeBooking(row));
      } catch (error) {
        report.push(`SKIP record ${row?.id ?? "senza-id"} da ${file}: ${error.message}`);
      }
    }
  }

  return { normalized, report };
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env.local non trovato in ${ROOT}`);
  }

  const env = readEnv(ENV_PATH);
  const base = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  if (!base || !token) {
    throw new Error("KV_REST_API_URL o KV_REST_API_TOKEN mancanti");
  }

  const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FILES;
  const { normalized, report } = loadRows(files);
  const current = await readKv(base, token);
  const byId = new Map((current.data ?? []).map((row) => [row.id, row]));

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const row of normalized) {
    const previous = byId.get(row.id);
    if (!previous) {
      byId.set(row.id, row);
      inserted += 1;
      continue;
    }
    if (updatedMs(row) > updatedMs(previous) || row.channel !== previous.channel || row.lodge !== previous.lodge || row.totalAmount !== previous.totalAmount || row.notes !== previous.notes) {
      const { importSourceFile: _discardedImportSourceFile, ...previousClean } = previous;
      byId.set(row.id, { ...previousClean, ...row, createdAt: previous.createdAt ?? row.createdAt });
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  const next = Array.from(byId.values()).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const payload = {
    v: Number(current.v ?? 0) + 1,
    ts: new Date().toISOString(),
    data: next,
  };
  await writeKv(base, token, payload);

  console.log(JSON.stringify({
    files,
    discovered: normalized.length,
    inserted,
    updated,
    unchanged,
    total: next.length,
    report,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
