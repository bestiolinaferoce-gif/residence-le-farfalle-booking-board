import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Residence Le Farfalle — Booking Board",
  description: "Board prenotazioni mensile per 5 camere",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
