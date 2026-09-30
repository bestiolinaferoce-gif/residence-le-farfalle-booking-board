import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { DEFAULT_PROPERTY } from "@/lib/property";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: `${DEFAULT_PROPERTY.name} — Booking Board`,
  description: `Gestione prenotazioni ${DEFAULT_PROPERTY.name} — ${DEFAULT_PROPERTY.municipality}.`,
  manifest: "/manifest.webmanifest",
  applicationName: "Le Farfalle Board",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Le Farfalle Board" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Area riservata al gestore: fuori dai motori di ricerca, sempre.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#061a20" },
    { media: "(prefers-color-scheme: light)", color: "#fbf7f2" },
  ],
  width: "device-width",
  initialScale: 1,
  // Il gestore consulta la board a bordo piscina: lo zoom deve restare possibile.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      className={`${manrope.variable} ${fraunces.variable}`}
      /* Lo script qui sotto scrive la classe del tema prima dell'idratazione:
         la differenza col markup del server è voluta, non un errore. */
      suppressHydrationWarning
    >
      <head>
        {/*
          Il tema si applica prima del primo paint: senza questo, chi ha scelto
          il tema chiaro vede un lampo scuro a ogni caricamento.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var e=document.documentElement;var s=JSON.parse(localStorage.getItem('le-farfalle-booking-board:ui:v1')||'{}');if(s.darkMode===false){e.classList.add('light')}else{e.classList.add('dark')}}catch(x){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
