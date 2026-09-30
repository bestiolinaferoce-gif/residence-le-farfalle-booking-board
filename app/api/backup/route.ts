import { NextRequest, NextResponse } from "next/server";
import { bookingReadAuthError } from "@/lib/bookingsApiAuth";
import { kvGet, SETTINGS_KEY_KV } from "@/lib/kv";
import { readBookingsKV } from "@/lib/kvCas";
import { normalizeSettings, type BoardSettings } from "@/lib/settings";
import type { Booking } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Backup scaricabile di tutto ciò che serve a ricostruire la board: dati e
 * configurazione. Formato JSON per il ripristino, CSV per aprirlo in Excel e
 * darlo al commercialista.
 *
 * Chiamato anche dal cron notturno, che lo salva come snapshot.
 */

const CSV_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "id", label: "ID" },
  { key: "guestName", label: "Ospite" },
  { key: "lodge", label: "Camera" },
  { key: "checkIn", label: "Check-in" },
  { key: "checkOut", label: "Check-out" },
  { key: "status", label: "Stato" },
  { key: "channel", label: "Canale" },
  { key: "guestsCount", label: "Adulti" },
  { key: "totalAmount", label: "Totale" },
  { key: "depositAmount", label: "Acconto" },
  { key: "depositReceived", label: "Acconto ricevuto" },
  { key: "balancePaid", label: "Saldo incassato" },
  { key: "paymentMethod", label: "Pagamento" },
  { key: "notes", label: "Note" },
  { key: "createdAt", label: "Creata il" },
  { key: "updatedAt", label: "Aggiornata il" },
  { key: "deletedAt", label: "Nel cestino dal" },
];

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "boolean" ? (value ? "sì" : "no") : String(value);
  // Excel italiano legge il punto e virgola; le virgolette vanno raddoppiate.
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(bookings: Booking[]): string {
  const header = CSV_COLUMNS.map((column) => csvCell(column.label)).join(";");
  const rows = bookings.map((booking) =>
    CSV_COLUMNS.map((column) => csvCell((booking as unknown as Record<string, unknown>)[column.key])).join(";")
  );
  // BOM: senza, Excel su Windows sbaglia gli accenti.
  return "﻿" + [header, ...rows].join("\r\n");
}

export async function GET(req: NextRequest) {
  const authErr = bookingReadAuthError(req);
  if (authErr) return authErr;

  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  const payload = await readBookingsKV();
  const bookings = payload?.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    return new NextResponse(toCsv(bookings), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="le-farfalle-prenotazioni-${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const settings = normalizeSettings(await kvGet<BoardSettings>(SETTINGS_KEY_KV));

  return new NextResponse(
    JSON.stringify({ exportedAt: new Date().toISOString(), version: payload?.v ?? 0, settings, bookings }, null, 2),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="le-farfalle-backup-${today}.json"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
