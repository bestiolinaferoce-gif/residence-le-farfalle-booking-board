import type { BookingChannel, BookingPrefill } from "./types";
import { LODGES } from "./types";

const LODGE_REGEX = new RegExp(`\\b(${LODGES.join("|")})\\b`, "i");
const DATE_NUM_REGEX = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g;
const EUR_REGEX = /(\d+(?:[.,]\d{2})?)\s*€|€\s*(\d+(?:[.,]\d{2})?)/gi;
const GUESTS_REGEX = /\b(\d+)\s*(?:ospiti?|persone?|pax|guests?|p\.?)\b/i;

const MONTH_NAMES: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const DATE_WORD_REGEX = new RegExp(
  `\\b(\\d{1,2})\\s+(${Object.keys(MONTH_NAMES).join("|")})\\s+(\\d{4})\\b`,
  "gi"
);

function parseDate(s: string): string | undefined {
  // already normalized to dashes
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) {
    let d = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (d > 12 && mo <= 12) [d, mo] = [mo, d];
    else if (mo > 12) [d, mo] = [mo, d];
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return undefined;
}

function parseAmount(s: string): number {
  const n = s.replace(",", ".").replace(/\s/g, "");
  return Math.max(0, parseFloat(n) || 0);
}

function extractDates(text: string): string[] {
  const entries: { iso: string; pos: number }[] = [];
  const seen = new Set<string>();

  // Word-based Italian/English dates: "15 marzo 2025" — higher confidence, processed first
  const wordRegex = new RegExp(DATE_WORD_REGEX.source, "gi");
  let wm: RegExpExecArray | null;
  while ((wm = wordRegex.exec(text))) {
    const day = parseInt(wm[1], 10);
    const mo = MONTH_NAMES[wm[2].toLowerCase()] ?? 0;
    const y = parseInt(wm[3], 10);
    if (mo > 0 && day >= 1 && day <= 31) {
      const iso = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!seen.has(iso)) {
        seen.add(iso);
        entries.push({ iso, pos: wm.index });
      }
    }
  }

  // Numeric dates — skip those already covered by word form
  const numRegex = new RegExp(DATE_NUM_REGEX.source, "g");
  let nm: RegExpExecArray | null;
  while ((nm = numRegex.exec(text))) {
    const raw = nm[1].replace(/[.\/]/g, "-");
    const parsed = parseDate(raw);
    if (parsed && !seen.has(parsed)) {
      seen.add(parsed);
      entries.push({ iso: parsed, pos: nm.index });
    }
  }

  entries.sort((a, b) => a.pos - b.pos);
  return entries.map((e) => e.iso);
}

function extractAmounts(text: string): { total: number; deposit: number } {
  const DEPOSIT_KW = /caparra|acconto|deposit[oa]?|anticipo/i;
  const TOTAL_KW = /total[ei]?|importo|saldo|prezzo|costo/i;

  let total = 0;
  let deposit = 0;
  const untagged: number[] = [];

  const eurRegex = new RegExp(EUR_REGEX.source, "gi");
  let am: RegExpExecArray | null;
  while ((am = eurRegex.exec(text))) {
    const v = parseAmount(am[1] || am[2] || "0");
    if (v <= 0) continue;
    // Check surrounding context (~80 chars before, ~30 after)
    const ctx = text.slice(Math.max(0, am.index - 80), am.index + 30);
    if (DEPOSIT_KW.test(ctx)) {
      if (deposit === 0) deposit = v;
    } else if (TOTAL_KW.test(ctx)) {
      if (total === 0) total = v;
    } else {
      untagged.push(v);
    }
  }

  // Fallback: first untagged amount → total, second → deposit
  if (total === 0 && untagged.length > 0) total = untagged[0];
  if (deposit === 0 && untagged.length > 1) deposit = untagged[1];

  return { total, deposit };
}

function extractChannel(text: string): BookingChannel | undefined {
  if (/\bairbnb\b/i.test(text)) return "airbnb";
  if (/\bbooking\.com\b/i.test(text)) return "booking";
  if (/\bexpedia\b/i.test(text)) return "expedia";
  return undefined;
}

export function parseEmail(text: string): BookingPrefill {
  let guestName = "";
  const namePatterns = [
    // Email salutation: "Gentile Mario Rossi" / "Dear John Smith"
    /(?:gentile|dear|caro|cara)\s+(?:sig(?:nor[ae]?)?\.?\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,48})/i,
    // Explicit label: "Ospite: Mario Rossi"
    /(?:ospite|guest|nome|cognome|signor[ea]?|sig\.?)\s*[:‒–—\-]?\s*([A-Za-zÀ-ÿ\s]{2,50})/i,
    // "prenotazione per Mario Rossi"
    /(?:prenotazione|booking|prenotato)\s+(?:per|da|di)\s+([A-Za-zÀ-ÿ\s]{2,50})/i,
    // Capitalized First Last at start of line
    /^([A-Z][a-zà-ù]+\s+[A-Z][a-zà-ù]+)(?:\s|,|$)/m,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) {
      guestName = m[1].trim().replace(/\s{2,}/g, " ");
      break;
    }
  }

  const dates = extractDates(text);
  const checkIn = dates[0];
  const checkOut = dates[1];

  const lodgeMatch = text.match(LODGE_REGEX);
  const lodge = lodgeMatch
    ? (LODGES.find((l) => l.toLowerCase() === lodgeMatch[1].toLowerCase()) ?? undefined)
    : undefined;

  const { total: totalAmount, deposit: depositAmount } = extractAmounts(text);

  const guestsMatch = text.match(GUESTS_REGEX);
  const guestsCount = guestsMatch ? Math.max(1, parseInt(guestsMatch[1], 10)) : undefined;

  const channel = extractChannel(text);

  const result: BookingPrefill = {};
  if (guestName) result.guestName = guestName;
  if (checkIn) result.checkIn = checkIn;
  if (checkOut) result.checkOut = checkOut;
  if (lodge) result.lodge = lodge;
  if (totalAmount > 0) result.totalAmount = totalAmount;
  if (depositAmount > 0) result.depositAmount = depositAmount;
  if (guestsCount) result.guestsCount = guestsCount;
  if (channel) result.channel = channel;

  return result;
}
