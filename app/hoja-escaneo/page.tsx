"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Poster, Serie } from "@/lib/types";
import { useAuth } from "@/app/components/AuthProvider";

// Orden de series (igual que en el cierre) para que la hoja salga ordenada.
const SERIES_ORDER = [
  "Life is Food - Kitchen", "Animals", "Fun", "Frases",
  "Bauhaus", "Berlin Prints", "Berlin Botanica", "Cocina",
];

// Contenido de cada QR: OR|<posterId|COMBO>|<talla>. La pantalla de escaneo lo lee.
const codePoster = (id: string, t: "A4" | "A3") => `OR|${id}|${t}`;
const codeCombo = (t: "A4" | "A3") => `OR|COMBO|${t}`;

interface PosterConSerie extends Poster { series?: Serie }

// hex -> [r,g,b] 0..1
function hex(h: string): [number, number, number] {
  const s = (h || "#333333").replace("#", "");
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
}
// tinte claro del color de serie (fondo de fila)
function tint(h: string, f: number): [number, number, number] {
  const s = (h || "#333333").replace("#", "");
  const m = (v: number) => (v + (255 - v) * (1 - f)) / 255;
  return [m(parseInt(s.slice(0, 2), 16)), m(parseInt(s.slice(2, 4), 16)), m(parseInt(s.slice(4, 6), 16))];
}

export default function HojaEscaneoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posters, setPosters] = useState<PosterConSerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (user && user.rol === "empleado") { router.replace("/sesion"); return; }
  }, [user, router]);

  useEffect(() => {
    supabase.from("posters").select("*, series(*)").eq("activo", true).order("nombre").then(({ data }) => {
      setPosters((data as PosterConSerie[]) || []);
      setLoading(false);
    });
  }, []);

  const totalCodigos = posters.reduce((n, p) => n + (p.tiene_a4 ? 1 : 0) + (p.tiene_a3 ? 1 : 0), 0);

  async function generarPDF() {
    if (posters.length === 0) return;
    setGenerando(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const QRCode = (await import("qrcode")).default;

      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const A4C = rgb(0.706, 0.325, 0.035), A3C = rgb(0.114, 0.306, 0.847), INK = rgb(0.07, 0.07, 0.09), GREY = rgb(0.45, 0.45, 0.5);

      const cache: Record<string, import("pdf-lib").PDFImage> = {};
      async function img(text: string) {
        if (!cache[text]) {
          const url = await QRCode.toDataURL(text, { margin: 0, width: 160, errorCorrectionLevel: "M" });
          cache[text] = await pdf.embedPng(url);
        }
        return cache[text];
      }

      const PW = 595.28, PH = 841.89, MX = 34, MT = 34, MB = 40, QS = 46, rowH = QS + 14;
      let page: import("pdf-lib").PDFPage, y = 0, pageNum = 0;
      const nueva = () => {
        page = pdf.addPage([PW, PH]); pageNum++; y = PH - MT;
        page.drawText(`Ohne Rotkohl · Hoja de escaneo · pág. ${pageNum}`, { x: MX, y: 18, size: 8, font, color: GREY });
      };
      nueva();

      // Cabecera
      page!.drawRectangle({ x: 0, y: PH - MT - 6, width: PW, height: MT + 6, color: INK });
      page!.drawText("HOJA DE ESCANEO", { x: MX, y: PH - 24, size: 15, font: bold, color: rgb(1, 1, 1) });
      page!.drawText("Escanea el QR A4 o A3 al vender. Combo: escanea los 3 pósters y luego el QR del combo.", { x: MX, y: PH - 37, size: 8, font, color: rgb(0.8, 0.8, 0.85) });
      y = PH - MT - 20;

      // Caja de combos
      const comboH = QS + 26;
      page!.drawRectangle({ x: MX, y: y - comboH, width: PW - 2 * MX, height: comboH, borderColor: INK, borderWidth: 1.5, color: rgb(0.97, 0.97, 0.98) });
      page!.drawText("COMBOS", { x: MX + 10, y: y - 16, size: 9, font: bold, color: INK });
      const ccx = PW / 2 - 70;
      const comboCell = async (cx: number, code: string, label: string, col: import("pdf-lib").RGB) => {
        page!.drawImage(await img(code), { x: cx, y: y - comboH + 14, width: QS, height: QS });
        page!.drawText(label, { x: cx - 4, y: y - comboH + 6, size: 8, font: bold, color: col });
      };
      await comboCell(ccx, codeCombo("A4"), "COMBO A4", A4C);
      await comboCell(ccx + 90, codeCombo("A3"), "COMBO A3", A3C);
      y -= comboH + 14;

      // Series ordenadas
      const ordered = [
        ...SERIES_ORDER.filter((s) => posters.some((p) => p.series?.nombre === s)),
        ...[...new Set(posters.filter((p) => !SERIES_ORDER.includes(p.series?.nombre || "")).map((p) => p.series?.nombre || "Otros"))],
      ];
      for (const serie of ordered) {
        const items = posters.filter((p) => (p.series?.nombre || "Otros") === serie).sort((a, b) => a.nombre.localeCompare(b.nombre));
        if (items.length === 0) continue;
        const col = hex(items[0].series?.color || "#333333");
        const bandH = 20;
        if (y - bandH - rowH < MB) nueva();
        page!.drawRectangle({ x: MX, y: y - bandH, width: PW - 2 * MX, height: bandH, color: rgb(col[0], col[1], col[2]) });
        page!.drawText(serie.toUpperCase(), { x: MX + 8, y: y - 14, size: 10, font: bold, color: rgb(1, 1, 1) });
        y -= bandH + 4;

        const tc = tint(items[0].series?.color || "#333333", 0.10);
        let i = 0;
        for (const p of items) {
          if (y - rowH < MB) nueva();
          if (i % 2 === 0) page!.drawRectangle({ x: MX, y: y - rowH + 2, width: PW - 2 * MX, height: rowH - 2, color: rgb(tc[0], tc[1], tc[2]) });
          page!.drawText(p.nombre, { x: MX + 10, y: y - rowH / 2 - 4, size: 11, font: bold, color: INK });
          const rightEdge = PW - MX - 6, cy = y - rowH / 2;
          const cell = async (qx: number, code: string, label: string, col2: import("pdf-lib").RGB, on: boolean) => {
            if (!on) return;
            page!.drawImage(await img(code), { x: qx, y: cy - QS / 2, width: QS, height: QS });
            page!.drawText(label, { x: qx - 18, y: cy - 4, size: 9, font: bold, color: col2 });
          };
          await cell(rightEdge - QS - 74, codePoster(p.id, "A4"), "A4", A4C, p.tiene_a4);
          await cell(rightEdge - QS, codePoster(p.id, "A3"), "A3", A3C, p.tiene_a3);
          y -= rowH; i++;
        }
        y -= 8;
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "hoja-escaneo-ohne-rotkohl.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hoja de escaneo</h1>
        <p className="text-gray-500 text-sm">Genera la hoja con un QR A4 y A3 por diseño para escanear las ventas en el mercado.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="text-sm text-gray-700 space-y-1.5">
          <p className="flex items-start gap-2"><span className="text-purple-600 font-bold">1.</span> Imprime la hoja y llévala al stand.</p>
          <p className="flex items-start gap-2"><span className="text-purple-600 font-bold">2.</span> Al vender, escanea el QR A4 o A3 de ese diseño.</p>
          <p className="flex items-start gap-2"><span className="text-purple-600 font-bold">3.</span> Combo: escanea los 3 pósters y luego el QR de combo (A4 o A3).</p>
        </div>
        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          {loading ? "Cargando diseños..." : `${posters.length} diseños · ${totalCodigos} códigos + 2 de combo`}
        </div>
        <button
          onClick={generarPDF}
          disabled={loading || generando || posters.length === 0}
          className="w-full bg-black text-white rounded-2xl py-3.5 font-semibold text-base disabled:opacity-40 hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
        >
          {generando ? "Generando PDF..." : "Descargar hoja en PDF"}
        </button>
      </div>

      {/* Acceso a la prueba de escaneo (beta) */}
      <a
        href="/escanear"
        className="block w-full text-center bg-purple-50 border-2 border-purple-200 text-purple-700 rounded-2xl py-3.5 font-semibold hover:bg-purple-100 transition-colors"
      >
        Probar escaneo (beta) →
      </a>
    </div>
  );
}
