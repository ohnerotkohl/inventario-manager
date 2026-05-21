"use client";
import { useEffect, useState } from "react";
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

export default function ImprimirPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const raw = localStorage.getItem("or_print_job");
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
          if (originalName) urlMap[originalName] = entry.signedUrl;
        });

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
  }, []);

  const totalPages = slots.length;
  const totalDesigns = new Set(slots.map((s) => s.nombre)).size;
  const missing = slots.filter((s) => !s.signedUrl).map((s) => s.nombre);
  const uniqueMissing = [...new Set(missing)];

  if (loading) {
    return (
      <div style={{ fontFamily: "sans-serif", textAlign: "center", padding: 48 }}>
        <p style={{ fontSize: 16, color: "#555" }}>Preparando imágenes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: 32 }}>
        <p style={{ color: "#dc2626", fontWeight: 700 }}>Error: {error}</p>
        <p style={{ color: "#555", marginTop: 8 }}>Asegúrate de que el bucket "Posters" existe en Supabase Storage.</p>
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
        @page { margin: 0; size: auto; }
        @media print {
          html, body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page {
            page-break-after: always;
            break-after: page;
            margin: 0; padding: 0;
            width: 100%; height: 100vh;
            display: flex; align-items: center; justify-content: center;
          }
          .print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .print-page img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }
          .missing-page { display: none; }
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
      <div className="no-print" style={{ background: "#000", color: "#fff", padding: "12px 24px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
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
        <button
          onClick={() => window.print()}
          style={{ background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* Pages */}
      {slots.map((slot) => (
        <div key={slot.key} className={`print-page ${!slot.signedUrl ? "missing-page" : ""}`}>
          {slot.signedUrl ? (
            <img src={slot.signedUrl} alt={slot.nombre} />
          ) : (
            <div style={{ textAlign: "center", color: "#ccc", padding: 32 }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#aaa" }}>{slot.nombre}</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Imagen no subida aún · no se imprimirá</p>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
