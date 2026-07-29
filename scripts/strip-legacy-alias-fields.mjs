#!/usr/bin/env node
// Rimuove i campi duplicati dell'import Booking.com 2026-05 dal payload KV.
// Dry-run di default. Scrive solo con --apply.
//   node scripts/strip-legacy-alias-fields.mjs
//   node scripts/strip-legacy-alias-fields.mjs --apply

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "lfb_bookings";
const LEGACY_FIELDS = ["room", "adults", "children", "deposit", "depositStatus", "breakfast", "nights"];
const CANONICAL = [
  "id", "guestName", "lodge", "checkIn", "checkOut", "status", "channel", "notes",
  "guestsCount", "childrenCount", "totalAmount", "depositAmount", "depositReceived",
  "extrasAmount", "cleaningFee", "touristTax", "economicNotes", "checkInTime", "checkOutTime",
  "breakfastIncluded", "createdAt", "updatedAt", "bookingRef", "externalSyncKey", "dataOrigin",
];

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
if (!BASE || !TOKEN) throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN mancanti in .env.local");

const apply = process.argv.includes("--apply");

async function kv(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${path} → HTTP ${res.status}`);
  return res.json();
}

const { result } = await kv(`/get/${KEY}`);
if (!result) throw new Error(`Chiave KV "${KEY}" vuota: interrotto.`);
const payload = JSON.parse(result);
const before = payload.data;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(ROOT, `backups/kv-${KEY}-v${payload.v}-${stamp}.json`);
mkdirSync(dirname(backupPath), { recursive: true });
writeFileSync(backupPath, result);

const after = before.map((b) => {
  const copy = { ...b };
  for (const f of LEGACY_FIELDS) delete copy[f];
  return copy;
});

// I campi canonici devono restare byte-identici: la migrazione toglie soltanto.
const drift = [];
before.forEach((b, i) => {
  for (const f of CANONICAL) {
    if (JSON.stringify(b[f]) !== JSON.stringify(after[i][f])) {
      drift.push(`${b.guestName}.${f}: ${JSON.stringify(b[f])} → ${JSON.stringify(after[i][f])}`);
    }
  }
});
if (drift.length) {
  console.error("ABORT — un campo canonico sarebbe cambiato:");
  drift.forEach((d) => console.error("  " + d));
  process.exit(1);
}

const removed = {};
before.forEach((b, i) => {
  for (const f of LEGACY_FIELDS) {
    if (b[f] !== undefined && after[i][f] === undefined) removed[f] = (removed[f] ?? 0) + 1;
  }
});

console.log(`KV v${payload.v} — ${before.length} record`);
console.log(`Backup: ${backupPath}`);
console.log("Campi rimossi (n. record):");
for (const f of LEGACY_FIELDS) console.log(`  ${f.padEnd(14)} ${removed[f] ?? 0}`);
console.log(`bookingRef preservati: ${after.filter((b) => b.bookingRef).length}`);
console.log(`Campi canonici modificati: 0`);

if (!apply) {
  console.log("\nDRY-RUN. Nessuna scrittura. Rilancia con --apply per applicare.");
  process.exit(0);
}

const next = { v: payload.v + 1, ts: new Date().toISOString(), data: after };
await kv("/pipeline", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify([
    ["SET", `${KEY}_backup_v${payload.v}`, result],
    ["SET", KEY, JSON.stringify(next)],
  ]),
});
console.log(`\nApplicato. v${payload.v} → v${next.v}. Backup KV: ${KEY}_backup_v${payload.v}`);
