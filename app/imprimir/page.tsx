"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PrintItem {
  nombre: string;
  talla: "A4" | "A3";
  qty: number;
}

interface Slot {
  nombre: string;
  talla: "A4" | "A3";
  signedUrl: string;
  key: string;
}

export default function ImprimirPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  useEffect(() => {
    async function init() {
      try {
        const raw = localStorage.getItem("or_print_job");
        if (!raw) { setLoading(false); return; }
        const items: PrintItem[] = JSON.parse(raw);
        if (items.length === 0) { setLoading(false); return; }

        // Get signed URLs for all unique poster names
        const uniqueNames = [...new Set(items.map((i) => i.nombre))];
        const paths = uniqueNames.map((n) => `${n}.jpg`);
        const { data, error: storageError } = await supabase.storage
          .from("posters")
          .createSignedUrls(paths, 3600);

        if (storageError) throw storageError;

        const urlMap: Record<string, string> = {};
        (data || []).forEach((entry) => {
          if (!entry.path) return;
          const nombre = entry.path.replace(".jpg", "");
          if (entry.signedUrl) urlMap[nombre] = entry.signedUrl;
        });

        // Expand into slots (one per copy)
        const expanded: Slot[] = items.flatMap((item) =>
          Array.from({ length: item.qty }, (_, i) => ({
            nombre: item.nombre,
            talla: item.talla,
            signedUrl: urlMap[item.nombre] || "",
            key: `${item.nombre}-${item.talla}-${i}`,
          }))
        );

        setSlots(expanded);
        setTotalImages(expanded.length);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando imágenes");
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (totalImages > 0 && loadedCount >= totalImages) {
      setTimeout(() => window.print(), 300);
    }
  }, [loadedCount, totalImages]);

  if (loading) {
    return (
      <div style={{ fontFamily: "sans-serif", textAlign: "center", padding: 48 }}>
        <p style={{ fontSize: 16, color: "#555" }}>Preparando imágenes para imprimir...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: 32 }}>
        <p style={{ color: "#dc2626", fontWeight: 700 }}>Error: {error}</p>
        <p style={{ color: "#555", marginTop: 8 }}>Asegúrate de que el bucket "posters" existe en Supabase Storage.</p>
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
        @media print {
          html, body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page {
            page-break-after: always;
            break-after: page;
            margin: 0; padding: 0;
            width: 100vw; height: 100vh;
            display: flex; align-items: center; justify-content: center;
          }
          .print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .print-page img {
            max-width: 100%; max-height: 100%;
            object-fit: contain;
          }
        }
        @media screen {
          body { background: #f3f4f6; font-family: sans-serif; margin: 0; }
          .print-page {
            width: 210mm; min-height: 297mm; background: white;
            margin: 24px auto;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          }
          .print-page img { max-width: 100%; max-height: 297mm; object-fit: contain; display: block; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ background: "#000", color: "#fff", padding: "12px 24px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {slots.length} página{slots.length !== 1 ? "s" : ""} · {new Set(slots.map(s => s.nombre)).size} diseño{new Set(slots.map(s => s.nombre)).size !== 1 ? "s" : ""}
          {loadedCount < totalImages && <span style={{ marginLeft: 12, opacity: 0.6, fontWeight: 400 }}>Cargando {loadedCount}/{totalImages}...</span>}
        </span>
        <button
          onClick={() => window.print()}
          style={{ background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* Pages */}
      {slots.map((slot) => (
        <div key={slot.key} className="print-page">
          {slot.signedUrl ? (
            <img
              src={slot.signedUrl}
              alt={slot.nombre}
              onLoad={() => setLoadedCount((n) => n + 1)}
              onError={() => setLoadedCount((n) => n + 1)}
            />
          ) : (
            <div style={{ textAlign: "center", color: "#aaa" }}>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{slot.nombre}</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Imagen no encontrada en Storage</p>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
