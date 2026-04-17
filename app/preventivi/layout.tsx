import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preventivi — Residence Le Farfalle",
  description: "Preventivi PDF personalizzati Residence Le Farfalle",
};

export default function PreventiviLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
