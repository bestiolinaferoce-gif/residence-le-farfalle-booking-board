This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
## Sync automatico Booking.com / Airbnb

La board ora supporta un import automatico via feed iCal esterni attraverso `POST /api/channel-sync`.

Configurazione:

```env
ICAL_SYNC_CONFIG=[
  {"channel":"booking","lodge":"Aurora","url":"https://...","label":"Booking Aurora"},
  {"channel":"booking","lodge":"Limone","url":"https://...","label":"Booking Limone"},
  {"channel":"booking","lodge":"Macaone","url":"https://...","label":"Booking Macaone"},
  {"channel":"booking","lodge":"Vanessa","url":"https://...","label":"Booking Vanessa"},
  {"channel":"airbnb","lodge":"Aurora","url":"https://...","label":"Airbnb Aurora"},
  {"channel":"airbnb","lodge":"Limone","url":"https://...","label":"Airbnb Limone"},
  {"channel":"airbnb","lodge":"Macaone","url":"https://...","label":"Airbnb Macaone"},
  {"channel":"airbnb","lodge":"Vanessa","url":"https://...","label":"Airbnb Vanessa"}
]
```

Uso:

- `GET /api/channel-sync` mostra le sorgenti configurate, senza esporre gli URL.
- `POST /api/channel-sync` importa i feed, aggiorna la booking board e segnala eventuali conflitti.
- In produzione la route richiede `X-Internal-Token` con il valore di `API_WRITE_SECRET`, `NEXT_PUBLIC_API_WRITE_SECRET` o `CRON_SECRET`.

Note operative:

- Questo flusso aggiorna bene disponibilità e cancellazioni, quindi è adatto per evitare overbooking.
- I feed iCal non sono affidabili per importare importi, caparre e dati ospite completi: quelli restano da verificare o da integrare con un partner/API dedicata.
- Su Vercel Hobby i cron frequenti non sono disponibili; per sync ogni 5-15 minuti conviene chiamare `POST /api/channel-sync` da n8n o da un job esterno.
