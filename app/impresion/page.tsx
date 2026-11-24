"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import type { Serie, Poster } from "@/lib/types";
import { POSTERS_ORDER, SERIES_ORDER } from "@/lib/ordenPosters";

// Impresión personalizada: elegir pósters a mano (para redes, un pedido
// especial, etc.) y sacar el PDF de A4 o A3 de un tirón. No toca el stock ni
// el almacén del estudio: solo prepara el trabajo para /imprimir.

// La selección se guarda en el navegador para no perderla al ir al PDF y volver
const CLAVE = "or_impresion_sel";

type PosterConSerie = Poster & { series?: Serie };

export default function ImpresionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, tr } = useLang();
  const [posters, setPosters] = useState<PosterConSerie[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busca, setBusca] = useState("");
  // `poster_id-A4` / `poster_id-A3` → cantidad
  const [sel, setSel] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    supabase.from("posters").select("*, series(*)").eq("activo", true).order("nombre").then(({ data }) => {
      setPosters((data as PosterConSerie[]) || []);
      setCargando(false);
    });
    try {
      const g = localStorage.getItem(CLAVE);
      if (g) setSel(JSON.parse(g));
    } catch { /* sin almacenamiento: se empieza vacío */ }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  function cambiar(key: string, delta: number) {
    setSel((prev) => {
      const n = Math.max(0, (prev[key] ?? 0) + delta);
      const next = { ...prev, [key]: n };
      if (n === 0) delete next[key];
      try { localStorage.setItem(CLAVE, JSON.stringify(next)); } catch { /* nada */ }
      return next;
    });
  }

  function limpiar() {
    setSel({});
    try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
  }

  const total = (talla: "A4" | "A3") =>
    Object.entries(sel).filter(([k]) => k.endsWith(`-${talla}`)).reduce((a, [, n]) => a + n, 0);

  function abrirPdf(talla: "A4" | "A3") {
    const items = posters
      .filter((p) => (sel[`${p.id}-${talla}`] ?? 0) > 0)
      .map((p) => ({ nombre: p.nombre, talla, qty: sel[`${p.id}-${talla}`] }));
    if (items.length === 0) return;
    localStorage.setItem("or_print_job", JSON.stringify(items));
    localStorage.setItem("or_print_mercado", "personalizada");
    localStorage.setItem("or_print_kind", "personalizada");
    window.open("/imprimir", "_blank");
  }

  const filtro = busca.trim().toLowerCase();
  // Busca en el nombre y en la serie ("bauhaus" saca toda la serie)
  const visibles = posters.filter((p) => !filtro || `${p.nombre} ${p.series?.nombre || ""}`.toLowerCase().includes(filtro));
  const grupos = [...new Set(visibles.map((p) => p.series?.nombre || ""))]
    .sort((a, b) => {
      const ia = SERIES_ORDER.indexOf(a), ib = SERIES_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    })
    .map((serie) => ({
      serie,
      posters: visibles
        .filter((p) => (p.series?.nombre || "") === serie)
        // Como en Stock: primero el orden fijo de la serie; los que no están en
        // la lista (pósters nuevos) van al final, por nombre
        .sort((a, b) => {
          const orden = POSTERS_ORDER[serie] || [];
          const ia = orden.indexOf(a.nombre), ib = orden.indexOf(b.nombre);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        }),
    }));

  const nA4 = total("A4"), nA3 = total("A3");

  // Función (no componente) para que los botones no se vuelvan a montar en cada clic
  const contador = (k: string) => {
    const n = sel[k] ?? 0;
    return (
      <div className="flex items-center gap-1.5">
        <button onClick={() => cambiar(k, -1)} disabled={n === 0} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30">−</button>
        <span className={`w-5 text-center font-bold text-sm ${n > 0 ? "text-gray-900" : "text-gray-300"}`}>{n}</span>
        <button onClick={() => cambiar(k, 1)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200">+</button>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-40">
      <div>
        <Link href="/restock" className="text-sm text-gray-500 hover:text-gray-800">← {t.restockTitle}</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{t.customPrint}</h1>
        <p className="text-gray-500 text-sm">{t.customPrintSub}</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t.customPrintSearch}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400"
        />
        {(nA4 > 0 || nA3 > 0) && (
          <button onClick={limpiar} className="text-xs text-gray-400 hover:text-red-500 underline px-2">{t.customPrintClear}</button>
        )}
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-8">{t.loading}</p>
      ) : (
        grupos.map(({ serie, posters: ps }) => (
          <div key={serie}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{serie || "—"}</p>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {ps.map((p, i) => (
                <div key={p.id} className={`px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${i < ps.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <p className="flex-1 min-w-[8rem] text-sm font-medium text-gray-900">{p.nombre}</p>
                  {p.tiene_a4 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-400">A4</span>
                      {contador(`${p.id}-A4`)}
                    </div>
                  )}
                  {p.tiene_a3 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-400">A3</span>
                      {contador(`${p.id}-A3`)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Barra flotante con los PDF, encima del menú de abajo */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          {(["A4", "A3"] as const).map((tl) => {
            const n = tl === "A4" ? nA4 : nA3;
            return (
              <button
                key={tl}
                onClick={() => abrirPdf(tl)}
                disabled={n === 0}
                className="flex-1 py-3 bg-[#5b4bc4] text-white rounded-2xl font-semibold text-sm shadow-lg shadow-[#5b4bc4]/40 hover:bg-[#6a5ad6] transition-colors disabled:opacity-40 disabled:shadow-none"
              >
                {tr("customPrintPdf", { talla: tl, n })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
