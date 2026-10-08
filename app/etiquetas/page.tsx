"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";

// Posición FIJA de la estampilla de Deutsche Post (Internetmarke "1 Stk") dentro
// del A4, en puntos PDF. Verificado: todas salen en el mismo sitio. Se recorta a
// esta caja y se coloca a tamaño real para que el datamatrix escanee bien.
const STAMP_BBOX = { left: 105, bottom: 678, right: 217, top: 747 };

const REMITENTE_KEY = "or_etiqueta_remitente";
const REMITENTE_DEFECTO = ["Ohne Rotkohl", "c/o Castellani", "Rudower Str. 3A", "12439 Berlin"];

const mm = (n: number) => (n * 72) / 25.4;

export default function EtiquetasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();
  const [remitente, setRemitente] = useState<string[]>(REMITENTE_DEFECTO);
  const [nombre, setNombre] = useState("");
  const [calle, setCalle] = useState("");
  const [cpCiudad, setCpCiudad] = useState("");
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && user.rol === "empleado") { router.replace("/sesion"); return; }
  }, [user, router]);

  // Remitente persistente (se escribe una vez y queda guardado en el móvil)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMITENTE_KEY);
      if (raw) setRemitente(JSON.parse(raw));
    } catch { /* localStorage no disponible */ }
  }, []);
  function guardarRemitente(lineas: string[]) {
    setRemitente(lineas);
    try { localStorage.setItem(REMITENTE_KEY, JSON.stringify(lineas)); } catch { /* */ }
  }

  const puedeGenerar = !!stampFile && nombre.trim() !== "" && !generando;

  async function generar() {
    if (!stampFile) { setError(t.labelNeedStamp); return; }
    if (!nombre.trim()) { setError(t.labelNeedRecipient); return; }
    setError("");
    setGenerando(true);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const INK = rgb(0.07, 0.07, 0.09), GREY = rgb(0.45, 0.45, 0.5), LINE = rgb(0.8, 0.8, 0.82);

      const PW = mm(102), PH = mm(152), M = mm(8);
      const page = pdf.addPage([PW, PH]);
      page.drawRectangle({ x: 2, y: 2, width: PW - 4, height: PH - 4, borderColor: LINE, borderWidth: 0.5 });

      // Estampilla (recortada a su caja fija, tamaño real, arriba a la derecha)
      const stampBytes = await stampFile.arrayBuffer();
      const stampDoc = await PDFDocument.load(stampBytes);
      const [emb] = await pdf.embedPages([stampDoc.getPage(0)], [STAMP_BBOX]);
      const sw = STAMP_BBOX.right - STAMP_BBOX.left, sh = STAMP_BBOX.top - STAMP_BBOX.bottom;
      page.drawPage(emb, { x: PW - M - sw, y: PH - M - sh, width: sw, height: sh });

      // Remitente (pequeño, arriba a la izquierda)
      let sy = PH - M - 10;
      page.drawText("Absender:", { x: M, y: sy, size: 7, font, color: GREY }); sy -= 11;
      for (const l of remitente.filter((x) => x.trim())) {
        page.drawText(l, { x: M, y: sy, size: 9, font, color: INK }); sy -= 11.5;
      }
      page.drawLine({ start: { x: M, y: sy + 4 }, end: { x: M + mm(45), y: sy + 4 }, thickness: 0.5, color: LINE });

      // Destinatario (grande, centro)
      const rSize = 17, rLead = 23;
      let ry = PH * 0.52;
      page.drawText("An:", { x: M, y: ry + rLead, size: 9, font, color: GREY });
      const lineas = [nombre.trim(), calle.trim(), cpCiudad.trim()].filter(Boolean);
      for (let i = 0; i < lineas.length; i++) {
        page.drawText(lineas[i], { x: M, y: ry, size: rSize, font: i === 0 ? bold : font, color: INK });
        ry -= rLead;
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug = nombre.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      a.href = url; a.download = `etiqueta-${slug || "envio"}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerando(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black";

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.labelsTitle}</h1>
        <p className="text-gray-500 text-sm">{t.labelsSubtitle}</p>
      </div>

      {/* Remitente */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t.labelSender}</p>
        <p className="text-xs text-gray-400 mb-1">{t.labelSenderHint}</p>
        {remitente.map((l, i) => (
          <input
            key={i}
            value={l}
            onChange={(e) => { const n = [...remitente]; n[i] = e.target.value; guardarRemitente(n); }}
            className={inputClass}
          />
        ))}
      </div>

      {/* Destinatario */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t.labelRecipient}</p>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t.labelName} className={inputClass} />
        <input value={calle} onChange={(e) => setCalle(e.target.value)} placeholder={t.labelStreet} className={inputClass} />
        <input value={cpCiudad} onChange={(e) => setCpCiudad(e.target.value)} placeholder={t.labelCityZip} className={inputClass} />
      </div>

      {/* Estampilla */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
        <p className="text-sm font-semibold text-gray-700">{t.labelStamp}</p>
        <p className="text-xs text-gray-400">{t.labelStampHint}</p>
        <input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => setStampFile(e.target.files?.[0] || null)} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 border-2 border-dashed ${stampFile ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 text-gray-600 hover:border-black hover:text-black"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {stampFile ? t.labelStampChange : t.labelStampUpload}
        </button>
        {stampFile && <p className="text-xs text-green-600 text-center">✓ {stampFile.name}</p>}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={generar}
        disabled={!puedeGenerar}
        className="w-full bg-black text-white rounded-2xl py-3.5 font-semibold text-base disabled:opacity-40 hover:bg-gray-900 transition-colors"
      >
        {generando ? t.labelGenerating : t.labelGenerate}
      </button>
      <p className="text-xs text-gray-400 text-center">{t.labelPrintHint}</p>
    </div>
  );
}
