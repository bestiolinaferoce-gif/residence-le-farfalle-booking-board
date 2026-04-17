/**
 * Notifica n8n per eventi booking: fetch verso webhook + log diagnostici (server-only).
 */

export type N8nBookingEventName =
  | "BOOKING_CREATED"
  | "BOOKING_MODIFIED"
  | "BOOKING_CANCELLED"
  | "DEPOSIT_RECEIVED";

export type N8nBookingEventPayload = {
  event: N8nBookingEventName;
  bookingId: string;
  property: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkin: string;
  checkout: string;
  nights: number;
  guests: number;
  lodge: string;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  notes: string;
  source: "booking-board";
};

const LOG = "[n8n/booking-webhook]";

function maskWebhookUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "(empty)";
  try {
    const u = new URL(trimmed);
    const q = u.search ? "?…" : "";
    return `${u.protocol}//${u.host}${u.pathname}${q}`;
  } catch {
    return "(unparseable-url)";
  }
}

export async function notifyN8NBookingEvents(
  events: N8nBookingEventPayload[],
  source: "api/bookings" | "api/bookings/merge-local"
): Promise<void> {
  const url = process.env.N8N_BOOKING_WEBHOOK_URL ?? "";
  const secret = process.env.N8N_WEBHOOK_SECRET ?? "";
  const secretSet = secret.length > 0;

  console.log(
    `${LOG} notify invoked source=${source} eventCount=${events.length} webhookUrl=${maskWebhookUrl(url)} webhookSecretConfigured=${secretSet}`
  );

  if (events.length === 0) {
    console.log(`${LOG} skip: zero events (nothing to send)`);
    return;
  }

  if (!url) {
    console.log(`${LOG} skip: N8N_BOOKING_WEBHOOK_URL missing or empty`);
    return;
  }

  if (!secretSet) {
    console.warn(`${LOG} warning: N8N_WEBHOOK_SECRET empty — request still sent`);
  }

  const results = await Promise.all(
    events.map(async (event, i) => {
      const label = `${i + 1}/${events.length}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": secret,
          },
          body: JSON.stringify(event),
        });
        let bodyTrunc = "";
        if (!res.ok) {
          try {
            bodyTrunc = (await res.text()).slice(0, 200);
          } catch {
            bodyTrunc = "";
          }
        }
        return { kind: "response" as const, label, event, res, bodyTrunc };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack =
          err instanceof Error && err.stack
            ? err.stack.split("\n").slice(0, 4).join(" | ")
            : "";
        return { kind: "error" as const, label, event, msg, stack };
      }
    })
  );

  let httpOk = 0;
  let httpFail = 0;
  let fetchErrors = 0;

  for (const r of results) {
    if (r.kind === "error") {
      fetchErrors += 1;
      console.error(
        `${LOG} event ${r.label} type=${r.event.event} bookingId=${r.event.bookingId} fetch error: ${r.msg}`
      );
      continue;
    }
    const { res, event, bodyTrunc, label } = r;
    if (res.ok) {
      httpOk += 1;
      console.log(
        `${LOG} event ${label} type=${event.event} bookingId=${event.bookingId} http=${res.status} ok=true`
      );
    } else {
      httpFail += 1;
      console.warn(
        `${LOG} event ${label} type=${event.event} bookingId=${event.bookingId} http=${res.status} ok=false`
      );
      if (bodyTrunc) console.warn(`${LOG} response body (truncated): ${bodyTrunc}`);
    }
  }

  console.log(
    `${LOG} done source=${source} total=${events.length} httpSuccess=${httpOk} httpRejected=${httpFail} fetchErrors=${fetchErrors}`
  );
}
