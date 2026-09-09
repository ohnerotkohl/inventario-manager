"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import type { Poster, Serie } from "@/lib/types";
import { useAuth } from "@/app/components/AuthProvider";

// Orden de series (igual que en el cierre) para que la hoja salga ordenada.
const SERIES_ORDER = [
  "Life is Food - Kitchen", "Animals", "Fun", "Frases",
  "Bauhaus", "Berlin Prints", "Berlin Botanica", "Cocina",
];

// Contenido que lleva cada QR. El lector "escribe" este texto en la pantalla de
// escaneo y la app lo interpreta. Formato estable: OR|<posterId|COMBO>|<talla>
function codePoster(posterId: string, talla: "A4" | "A3") { return `OR|${posterId}|${talla}`; }
function codeCombo(talla: "A4" | "A3") { return `OR|COMBO|${talla}`; }

interface PosterConSerie extends Poster { series?: Serie }

export default function HojaEscaneoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posters, setPosters] = useState<PosterConSerie[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.rol === "empleado") { router.replace("/sesion"); return; }
  }, [user, router]);

  useEffect(() => {
    supabase.from("posters").select("*, series(*)").eq("activo", true).order("nombre").then(({ data }) => {
      setPosters((data as PosterConSerie[]) || []);
      setLoading(false);
    });
  }, []);

  // Generar todos los QR (por póster+talla y los dos combos) una vez cargados.
  useEffect(() => {
    if (posters.length === 0) return;
    let cancelado = false;
    (async () => {
      const codes = new Set<string>();
      codes.add(codeCombo("A4"));
      codes.add(codeCombo("A3"));
      for (const p of posters) {
        if (p.tiene_a4) codes.add(codePoster(p.id, "A4"));
        if (p.tiene_a3) codes.add(codePoster(p.id, "A3"));
      }
      const mapa: Record<string, string> = {};
      for (const c of codes) {
        mapa[c] = await QRCode.toDataURL(c, { margin: 0, width: 120, errorCorrectionLevel: "M" });
      }
      if (!cancelado) setQr(mapa);
    })();
    return () => { cancelado = true; };
  }, [posters]);

  // Agrupar por serie en el orden definido
  const porSerie = SERIES_ORDER.map((nombreSerie) => ({
    serie: nombreSerie,
    items: posters
      .filter((p) => (p.series?.nombre || "") === nombreSerie)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  })).filter((g) => g.items.length > 0);

  // Pósters cuya serie no está en SERIES_ORDER (por si acaso), al final
  const enOrden = new Set(SERIES_ORDER);
  const otros = posters.filter((p) => !enOrden.has(p.series?.nombre || "")).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const listo = !loading && Object.keys(qr).length > 0;

  const QRImg = ({ code, label, color }: { code: string; label: string; color: string }) => (
    <div className="qcell">
      {qr[code] ? <img src={qr[code]} alt={code} className="qimg" /> : <div className="qimg qph" />}
      <span className="qlabel" style={{ color }}>{label}</span>
    </div>
  );

  return (
    <div className="hoja">
      <style>{`
        .hoja { background:#fff; color:#111; font-family: system-ui, sans-serif; padding:16px 20px 60px; }
        .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .btnprint { background:#111; color:#fff; border:none; border-radius:10px; padding:10px 18px; font-size:14px; font-weight:600; cursor:pointer; }
        .combos { display:flex; gap:24px; justify-content:center; border:2px solid #111; border-radius:12px; padding:10px; margin-bottom:16px; }
        .serie { margin-top:14px; }
        .serieTitle { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:#555; border-bottom:1px solid #ccc; padding-bottom:3px; margin-bottom:6px; }
        .row { display:flex; align-items:center; gap:10px; padding:3px 0; border-bottom:1px solid #f0f0f0; break-inside:avoid; }
        .rname { flex:1; font-size:13px; font-weight:600; }
        .codes { display:flex; gap:14px; }
        .qcell { display:flex; flex-direction:column; align-items:center; width:58px; }
        .qimg { width:52px; height:52px; }
        .qph { background:#f3f3f3; border:1px dashed #ccc; }
        .qlabel { font-size:9px; font-weight:800; margin-top:1px; letter-spacing:.04em; }
        .qempty { width:58px; }
        @media print {
          .toolbar { display:none; }
          .hoja { padding:0; }
          .row { border-bottom:1px solid #eee; }
        }
      `}</style>

      <div className="toolbar">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Hoja de escaneo</h1>
          <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>
            Escanea el código A4 o A3 de cada póster al venderlo. Para un combo, escanea los pósters y luego el código de combo.
          </p>
        </div>
        <button className="btnprint" onClick={() => window.print()} disabled={!listo}>
          {listo ? "Imprimir" : "Generando..."}
        </button>
      </div>

      {/* Códigos de combo, bien grandes y arriba */}
      <div className="combos">
        <QRImg code={codeCombo("A4")} label="COMBO A4" color="#b45309" />
        <QRImg code={codeCombo("A3")} label="COMBO A3" color="#1d4ed8" />
      </div>

      {[...porSerie, ...(otros.length > 0 ? [{ serie: "Otros", items: otros }] : [])].map((g) => (
        <div key={g.serie} className="serie">
          <p className="serieTitle">{g.serie}</p>
          {g.items.map((p) => (
            <div key={p.id} className="row">
              <span className="rname">{p.nombre}</span>
              <div className="codes">
                {p.tiene_a4
                  ? <QRImg code={codePoster(p.id, "A4")} label="A4" color="#b45309" />
                  : <span className="qempty" />}
                {p.tiene_a3
                  ? <QRImg code={codePoster(p.id, "A3")} label="A3" color="#1d4ed8" />
                  : <span className="qempty" />}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
