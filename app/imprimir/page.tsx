"use client";
import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/lib/supabase";

interface PrintItem {
  nombre: string;
  talla: "A4" | "A3";
  qty: number;
}

function toStorageFilename(nombre: string): string {
  return nombre
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ä/g, "a").replace(/Ä/g, "A")
    .replace(/ñ/g, "n").replace(/Ñ/g, "N")
    + ".jpg";
}

interface Slot {
  nombre: string;
  talla: "A4" | "A3";
  signedUrl: string;
  key: string;
}

// Supabase devuelve la URL firmada con el path SIN codificar. Si el nombre
// del archivo lleva '?' (p.ej. "Wie Geht's? - Mauerpark.jpg"), el navegador
// corta la URL en ese '?' y la descarga falla con 400. Codificamos cada
// segmento del path, dejando intacto el token.
function fixSignedUrl(u: string): string {
  const tokenIdx = u.lastIndexOf("?token=");
  if (tokenIdx === -1) return u;
  const prefix = u.slice(0, tokenIdx);
  const query = u.slice(tokenIdx);
  const marker = "/object/sign/";
  const markerIdx = prefix.indexOf(marker);
  if (markerIdx === -1) return u;
  const base = prefix.slice(0, markerIdx + marker.length);
  const path = prefix.slice(markerIdx + marker.length);
  // El path puede venir parcialmente codificado (espacios como %20): se
  // decodifica primero para no codificar dos veces.
  const encoded = path.split("/").map((seg) => {
    let raw = seg;
    try { raw = decodeURIComponent(seg); } catch { /* segmento con % literal */ }
    return encodeURIComponent(raw);
  }).join("/");
  return base + encoded + query;
}

// Dimensiones estándar en puntos PDF (1 pt = 1/72")
const PAGE_PT: Record<"A4" | "A3", [number, number]> = {
  A4: [595.28, 841.89],
  A3: [841.89, 1190.55],
};

// Píxeles mínimos del lado largo para imprimir a 150 dpi (calidad aceptable en póster)
const MIN_PX_LONG: Record<"A4" | "A3", number> = {
  A4: 1754,
  A3: 2480,
};

export default function ImprimirPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  // Nombre de la caja/mercado, para nombrar el PDF descargado
  const [mercadoNombre, setMercadoNombre] = useState("");

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const raw = localStorage.getItem("or_print_job");
        setMercadoNombre(localStorage.getItem("or_print_mercado") || "");
        if (!raw) { setLoading(false); return; }
        const items: PrintItem[] = JSON.parse(raw);
        if (items.length === 0) { setLoading(false); return; }

        const uniqueNames = [...new Set(items.map((i) => i.nombre))];
        // Map normalized storage filename → original DB name for reverse lookup
        const pathToName: Record<string, string> = {};
        uniqueNames.forEach((n) => {
          pathToName[toStorageFilename(n)] = n;
        });
        const paths = uniqueNames.map((n) => toStorageFilename(n));

        const { data, error: storageError } = await supabase.storage
          .from("Posters")
          .createSignedUrls(paths, 3600);

        if (storageError) throw storageError;

        const urlMap: Record<string, string> = {};
        (data || []).forEach((entry) => {
          if (!entry.path || !entry.signedUrl) return;
          const originalName = pathToName[entry.path];
          if (originalName) urlMap[originalName] = fixSignedUrl(entry.signedUrl);
        });

        // Si NINGUNA imagen se pudo firmar, no es que falten archivos: la nube
        // rechazó la petición completa. Mostrar el motivo real y ofrecer reintentar.
        if (paths.length > 0 && Object.keys(urlMap).length === 0) {
          const motivo = (data || []).map((e) => e.error).find(Boolean);
          throw new Error(
            motivo
              ? `La nube rechazó la petición de imágenes. Motivo: ${motivo}`
              : "La nube no respondió al preparar las imágenes (fallo temporal). Tus archivos siguen subidos: toca Reintentar."
          );
        }

        const expanded: Slot[] = items.flatMap((item) =>
          Array.from({ length: item.qty }, (_, i) => ({
            nombre: item.nombre,
            talla: item.talla,
            signedUrl: urlMap[item.nombre] || "",
            key: `${item.nombre}-${item.talla}-${i}`,
          }))
        );

        setSlots(expanded);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando imágenes");
        setLoading(false);
      }
    }
    init();
  }, [reloadKey]);

  async function downloadPdf(talla: "A4" | "A3") {
    setGenerating(true);
    setPdfWarnings([]);
    const warnings: string[] = [];
    try {
      const jobSlots = slots.filter((s) => s.talla === talla && s.signedUrl);
      const pdf = await PDFDocument.create();

      // Cada diseño se descarga y se incrusta UNA sola vez; las repeticiones
      // son páginas que referencian la misma imagen (el PDF no se infla).
      const embedded: Record<string, Awaited<ReturnType<typeof pdf.embedJpg>> | null> = {};
      const uniqueNames = [...new Set(jobSlots.map((s) => s.nombre))];
      for (const nombre of uniqueNames) {
        const url = jobSlots.find((s) => s.nombre === nombre)!.signedUrl;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const bytes = await res.arrayBuffer();
          let img;
          try {
            img = await pdf.embedJpg(bytes);
          } catch {
            // El bucket guarda .jpg, pero por si algún archivo es realmente PNG
            img = await pdf.embedPng(bytes);
          }
          embedded[nombre] = img;
          const longSide = Math.max(img.width, img.height);
          if (longSide < MIN_PX_LONG[talla]) {
            warnings.push(`${nombre}: resolución baja para ${talla} (${img.width}×${img.height}px, se recomienda ≥${MIN_PX_LONG[talla]}px en el lado largo)`);
          }
        } catch {
          embedded[nombre] = null;
          warnings.push(`${nombre}: no se pudo descargar la imagen, no va en el PDF`);
        }
      }

      const [pw, ph] = PAGE_PT[talla];
      let pages = 0;
      for (const slot of jobSlots) {
        const img = embedded[slot.nombre];
        if (!img) continue;
        const page = pdf.addPage([pw, ph]);
        // Ajuste proporcional centrado: la imagen ocupa el máximo posible
        // sin deformarse ni recortarse.
        const scale = Math.min(pw / img.width, ph / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        pages++;
      }

      if (pages === 0) {
        setPdfWarnings(warnings.length > 0 ? warnings : ["No hay páginas que generar para " + talla]);
        return;
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fecha = new Date().toISOString().slice(0, 10);
      // Mercado saneado para nombre de archivo (sin espacios ni acentos raros)
      const mercadoSlug = mercadoNombre
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      a.href = url;
      a.download = `${mercadoSlug ? mercadoSlug + "-" : ""}imprimir-${talla}-${fecha}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfWarnings(warnings);
    } catch (e) {
      setPdfWarnings([e instanceof Error ? e.message : "Error generando el PDF"]);
    } finally {
      setGenerating(false);
    }
  }

  const totalPages = slots.length;
  const totalDesigns = new Set(slots.map((s) => s.nombre)).size;
  const missing = slots.filter((s) => !s.signedUrl).map((s) => s.nombre);
  const uniqueMissing = [...new Set(missing)];
  const tallas = [...new Set(slots.map((s) => s.talla))] as ("A4" | "A3")[];

  if (loading) {
    return (
      <div style={{ fontFamily: "sans-serif", textAlign: "center", padding: 48 }}>
        <p style={{ fontSize: 16, color: "#555" }}>Preparando imágenes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: 32, textAlign: "center" }}>
        <p style={{ color: "#dc2626", fontWeight: 700 }}>Error: {error}</p>
        <p style={{ color: "#555", marginTop: 8 }}>Suele ser un fallo pasajero de la conexión con la nube, no de tus imágenes.</p>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          style={{
            marginTop: 20, padding: "12px 32px", fontSize: 15, fontWeight: 600,
            color: "#fff", background: "#111827", border: "none", borderRadius: 12, cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div style={{ fontFamily: "sans-serif", textAlign: "center", padding: 48 }}>
        <p style={{ fontSize: 16 }}>No hay nada en la cola de impresión.</p>
        <p style={{ color: "#888", marginTop: 8 }}>Vuelve a la app y selecciona qué imprimir.</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        body { background: #f3f4f6; font-family: sans-serif; margin: 0; }
        .print-page {
          background: white;
          margin: 24px auto;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
        }
        .print-page.a4 { width: 210mm; height: 297mm; }
        .print-page.a3 { width: 297mm; height: 420mm; }
        .print-page img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#000", color: "#fff", padding: "12px 24px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {totalPages} página{totalPages !== 1 ? "s" : ""} · {totalDesigns} diseño{totalDesigns !== 1 ? "s" : ""}
          </span>
          {uniqueMissing.length > 0 && (
            <p style={{ fontSize: 11, color: "#f87171", margin: "2px 0 0", fontWeight: 400 }}>
              Sin imagen: {uniqueMissing.join(", ")} — sube el .jpg con ese nombre exacto
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tallas.map((talla) => (
            <button
              key={talla}
              onClick={() => downloadPdf(talla)}
              disabled={generating}
              style={{ background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 14, cursor: generating ? "wait" : "pointer", whiteSpace: "nowrap", opacity: generating ? 0.6 : 1 }}
            >
              {generating ? "Generando..." : `⬇ Descargar PDF ${talla}`}
            </button>
          ))}
        </div>
      </div>

      {/* Avisos del PDF generado */}
      {pdfWarnings.length > 0 && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, margin: "16px auto", maxWidth: 640, padding: "12px 16px" }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: "#92400e", margin: 0 }}>Avisos:</p>
          {pdfWarnings.map((w, i) => (
            <p key={i} style={{ fontSize: 12, color: "#92400e", margin: "4px 0 0" }}>· {w}</p>
          ))}
        </div>
      )}

      {/* Vista previa a tamaño real por talla */}
      {slots.map((slot) => (
        <div key={slot.key} className={`print-page ${slot.talla === "A4" ? "a4" : "a3"}`}>
          {slot.signedUrl ? (
            <img src={slot.signedUrl} alt={slot.nombre} />
          ) : (
            <div style={{ textAlign: "center", color: "#ccc", padding: 32 }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#aaa" }}>{slot.nombre}</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Imagen no subida aún · no irá en el PDF</p>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
