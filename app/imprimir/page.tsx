"use client";
import { useEffect, useState } from "react";

interface PrintItem {
  nombre: string;
  talla: "A4" | "A3";
  qty: number;
}

export default function ImprimirPage() {
  const [items, setItems] = useState<PrintItem[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("or_print_job");
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  // Expand items into individual image slots (qty copies each)
  const slots = items.flatMap((item) =>
    Array.from({ length: item.qty }, (_, i) => ({ ...item, key: `${item.nombre}-${item.talla}-${i}` }))
  );

  useEffect(() => {
    if (slots.length > 0 && loadedCount >= slots.length) {
      setAllLoaded(true);
      setTimeout(() => window.print(), 300);
    }
  }, [loadedCount, slots.length]);

  function onImageLoad() {
    setLoadedCount((n) => n + 1);
  }

  if (!supabaseUrl) {
    return <div style={{ padding: 32, fontFamily: "sans-serif" }}>Supabase no configurado.</div>;
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 32, fontFamily: "sans-serif", textAlign: "center" }}>
        <p style={{ fontSize: 18 }}>No hay nada en la cola de impresión.</p>
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
            margin: 0;
            padding: 0;
          }
          .print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        }
        @media screen {
          body { background: #f3f4f6; font-family: sans-serif; }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            background: white;
            margin: 24px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
        }
      `}</style>

      {/* Header (screen only) */}
      <div className="no-print" style={{ background: "#000", color: "#fff", padding: "12px 24px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {slots.length} página{slots.length !== 1 ? "s" : ""} · {items.length} diseño{items.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => window.print()}
          style={{ background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* Loading indicator */}
      {!allLoaded && (
        <div className="no-print" style={{ textAlign: "center", padding: 16, color: "#888", fontSize: 13 }}>
          Cargando imágenes... {loadedCount}/{slots.length}
        </div>
      )}

      {/* Print pages */}
      {slots.map((slot) => {
        const url = `${supabaseUrl}/storage/v1/object/public/posters/${encodeURIComponent(slot.nombre)}.jpg`;
        return (
          <div key={slot.key} className="print-page">
            <img
              src={url}
              alt={slot.nombre}
              onLoad={onImageLoad}
              onError={onImageLoad}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
            />
          </div>
        );
      })}
    </>
  );
}
