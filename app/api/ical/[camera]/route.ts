import { NextRequest, NextResponse } from "next/server";
import { BOOKINGS_KEY, SETTINGS_KEY_KV, kvGet } from "@/lib/kv";
import { normalizeSettings, type BoardSettings } from "@/lib/settings";
import { LODGES, type Booking, type Lodge } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Feed iCal per singola camera: è l'indirizzo da incollare nell'extranet di
 * Booking o Airbnb perché vedano le date già occupate.
 *
 * Non passa dal login — i crawler delle OTA non fanno login — quindi la difesa
 * è il token nell'URL. Senza ICAL_FEED_TOKEN configurato il feed resta aperto e
 * la risposta lo dichiara nell'intestazione del calendario.
 */

function toIcalDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

function escapeIcal(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** RFC 5545: righe oltre 75 ottetti vanno spezzate, altrimenti il feed è invalido. */
function foldLine(line: string): string {
  const MAX = 74;
  if (line.length <= MAX) return line;
  let out = "";
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      out += line.slice(0, MAX);
      pos = MAX;
    } else {
      out += "\r\n " + line.slice(pos, pos + MAX - 1);
      pos += MAX - 1;
    }
  }
  return out;
}

export async function GET(req: NextRequest, context: { params: { camera: string } }) {
  const expectedToken = process.env.ICAL_FEED_TOKEN?.trim();
  if (expectedToken) {
    const provided = req.nextUrl.searchParams.get("token")?.trim() ?? "";
    if (provided !== expectedToken) return new NextResponse("Forbidden", { status: 403 });
  }

  const { camera } = context.params;
  const roomId = decodeURIComponent(camera).replace(/\.ics$/i, "");

  if (!(LODGES as readonly string[]).includes(roomId)) {
    return new NextResponse("Camera non trovata", { status: 404 });
  }

  const [payload, storedSettings] = await Promise.all([
    kvGet<{ data: Booking[] } | Booking[]>(BOOKINGS_KEY),
    kvGet<BoardSettings>(SETTINGS_KEY_KV),
  ]);

  const bookings: Booking[] = Array.isArray(payload) ? payload : (payload?.data ?? []);
  const settings = normalizeSettings(storedSettings);
  const room = settings.rooms.find((r) => r.id === roomId);
  const roomName = room?.name ?? roomId;
  const propertyName = settings.property.name;

  // Solo le prenotazioni assegnate a questa camera: "Da assegnare" non è
  // inventario reale e annunciarlo occupato bloccherebbe vendite possibili.
  const occupied = bookings.filter(
    (b) => b.lodge === (roomId as Lodge) && !b.deletedAt && b.status !== "cancelled"
  );

  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const events = occupied.map((b) => {
    const lastModified = (b.updatedAt ?? b.createdAt ?? "").replace(/[-:]/g, "").replace(/\.\d+Z?$/, "Z");
    return [
      "BEGIN:VEVENT",
      foldLine(`UID:${b.id}@le-farfalle`),
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toIcalDate(b.checkIn)}`,
      `DTEND;VALUE=DATE:${toIcalDate(b.checkOut)}`,
      // I portali leggono solo le date: nessun dato personale dell'ospite nel feed.
      foldLine(`SUMMARY:Occupato — ${escapeIcal(roomName)}`),
      foldLine(`LOCATION:${escapeIcal(propertyName)} — ${escapeIcal(roomName)}`),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      ...(lastModified ? [`LAST-MODIFIED:${lastModified}`] : []),
      "END:VEVENT",
    ].join("\r\n");
  });

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${propertyName}//Booking Board//IT`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcal(`${propertyName} — ${roomName}`)}`),
    "X-WR-TIMEZONE:Europe/Rome",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${roomId.replace(/\s+/g, "-").toLowerCase()}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
