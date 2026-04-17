"use client";

import { FileDown, Printer } from "lucide-react";
import { useCallback, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type QuotePdfProps = {
  targetRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
};

export function QuotePdfExport({ targetRef, disabled }: QuotePdfProps) {
  const [loading, setLoading] = useState(false);

  const exportPdf = useCallback(async () => {
    const el = targetRef.current;
    if (!el || disabled) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f8f6f0",
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidthMm = pageWidth;

      const pageHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);
      let yPx = 0;

      if (canvas.height <= pageHeightPx) {
        const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;
        pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, imgWidthMm, imgHeightMm);
      } else {
        while (yPx < canvas.height) {
          const sliceH = Math.min(pageHeightPx, canvas.height - yPx);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d");
          if (!ctx) break;
          ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const imgData = slice.toDataURL("image/png", 1.0);
          const sliceH_mm = (sliceH * imgWidthMm) / canvas.width;
          if (yPx > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, sliceH_mm);
          yPx += sliceH;
        }
      }

      const fileName = `preventivo-le-farfalle-${new Date().toISOString().slice(0, 10)}.pdf`;
      try {
        pdf.save(fileName);
      } catch {
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      window.alert("Impossibile generare il PDF. Usa «Stampa / PDF sistema» e scegli Salva come PDF.");
    } finally {
      setLoading(false);
    }
  }, [targetRef, disabled]);

  const printPage = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="quotes-actions">
      <button
        type="button"
        className="quotes-btn quotes-btn-primary"
        onClick={exportPdf}
        disabled={disabled || loading}
      >
        <FileDown size={18} />
        {loading ? "Generazione PDF…" : "Scarica PDF"}
      </button>
      <button
        type="button"
        className="quotes-btn quotes-btn-ghost"
        onClick={printPage}
        disabled={disabled}
        title="Dialogo di stampa del browser: Salva come PDF"
      >
        <Printer size={18} />
        Stampa / PDF sistema
      </button>
    </div>
  );
}
