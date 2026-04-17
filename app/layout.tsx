import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Residence Le Farfalle — Booking Board",
  description: "Board prenotazioni mensile per 4 camere — Isola di Capo Rizzuto",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <head>
        {/* Apply dark mode class before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem('le-farfalle-booking-board:settings:v1')||'{}');if(s.darkMode!==false)document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
