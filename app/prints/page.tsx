"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";

type Talla = "A4" | "A3";
type Origen = "taller" | "externo";

interface PrintEstudio {
  id: string;
  poster_id: string;
  talla: Talla;
  cantidad: number;
  posters?: { nombre: string; series?: { nombre: string; color: string } | null } | null;
}

interface PrintEntrada {
  id: string;
  poster_id: string;
  talla: Talla;
  cantidad: number;
  origen: Origen;
  registrado_por: string | null;
  created_at: string;
  posters?: { nombre: string } | null;
}

interface PosterMin {
  id: string;
  nombre: string;
  tiene_a4: boolean;
  tiene_a3: boolean;
  series?: { nombre: string; color: string } | null;
}

export default function PrintsPage() {
  const { t, tr } = useLang();
  const router = useRouter();
  const { user } = useAuth();
  const [prints, setPrints] = useState<PrintEstudio[]>([]);
  const [entradas, setEntradas] = useState<PrintEntrada[]>([]);
  const [posters, setPosters] = useState<PosterMin[]>([]);
  const [loading, setLoading] = useState(true);

  const [formAbierto, setFormAbierto] = useState(false);
  const [fPoster, setFPoster] = useState("");
  // A4 y A3 se registran juntos en una sola entrada (feedback de Nuria)
  const [fCantA4, setFCantA4] = useState(0);
  const [fCantA3, setFCantA3] = useState(0);
  const [fOrigen, setFOrigen] = useState<Origen>("taller");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    fetchData();
  }, [user]);

  async function fetchData() {
    const [pRes, eRes, posRes] = await Promise.all([
      supabase.from("prints_estudio").select("*, posters(nombre, series(nombre, color))"),
      supabase.from("prints_entradas").select("*, posters(nombre)").order("created_at", { ascending: false }).limit(20),
      supabase.from("posters").select("id, nombre, tiene_a4, tiene_a3, series(nombre, color)").eq("activo", true).order("nombre"),
    ]);
    setPrints((pRes.data as unknown as PrintEstudio[]) || []);
    setEntradas((eRes.data as unknown as PrintEntrada[]) || []);
    setPosters((posRes.data as unknown as PosterMin[]) || []);
    setLoading(false);
  }

  if (loading) return <SkeletonPage />;
  if (user?.rol === "empleado") return null;

  async function registrarEntrada() {
    // Ambas tallas se guardan juntas en un solo paso
    const lineas: { talla: Talla; cantidad: number }[] = [];
    if (fCantA4 > 0) lineas.push({ talla: "A4", cantidad: fCantA4 });
    if (fCantA3 > 0) lineas.push({ talla: "A3", cantidad: fCantA3 });
    if (!fPoster || lineas.length === 0 || guardando) return;
    setGuardando(true);
    // 1) Registrar las entradas en el historial
    const { error: errEntrada } = await supabase.from("prints_entradas").insert(
      lineas.map((l) => ({
        poster_id: fPoster,
        talla: l.talla,
        cantidad: l.cantidad,
        origen: fOrigen,
        registrado_por: user?.nombre || null,
      }))
    );
    if (errEntrada) { setGuardando(false); alert(t.saveError); return; }
    // 2) Sumar al stock del almacén central (crear si no existe)
    for (const l of lineas) {
      const existente = prints.find((p) => p.poster_id === fPoster && p.talla === l.talla);
      if (existente) {
        await supabase.from("prints_estudio").update({ cantidad: existente.cantidad + l.cantidad, updated_at: new Date().toISOString() }).eq("id", existente.id);
      } else {
        await supabase.from("prints_estudio").insert({ poster_id: fPoster, talla: l.talla, cantidad: l.cantidad });
      }
    }
    setGuardando(false);
    setFPoster(""); setFCantA4(0); setFCantA3(0); setFOrigen("taller");
    setFormAbierto(false);
    fetchData();
  }

  // Eliminar del almacén todo el stock de un diseño (ambas tallas) y su historial de entradas
  async function eliminarPrint(posterId: string, nombre: string) {
    if (!confirm(tr("deletePrintConfirm", { name: nombre }))) return;
    await Promise.all([
      supabase.from("prints_estudio").delete().eq("poster_id", posterId),
      supabase.from("prints_entradas").delete().eq("poster_id", posterId),
    ]);
    fetchData();
  }

  // Agrupar el stock por diseño (A4 + A3 en la misma fila)
  type Fila = { nombre: string; posterId: string; serie: string; color: string; a4: number; a3: number };
  const porDiseno = new Map<string, Fila>();
  for (const p of prints) {
    const nombre = p.posters?.nombre || "—";
    const serie = p.posters?.series?.nombre || "—";
    const color = p.posters?.series?.color || "#6B7280";
    const f = porDiseno.get(nombre) || { nombre, posterId: p.poster_id, serie, color, a4: 0, a3: 0 };
    if (p.talla === "A4") f.a4 = p.cantidad;
    else f.a3 = p.cantidad;
    porDiseno.set(nombre, f);
  }
  const filas = [...porDiseno.values()].sort((a, b) => a.serie.localeCompare(b.serie) || a.nombre.localeCompare(b.nombre));
  const totalUnidades = prints.reduce((s, p) => s + p.cantidad, 0);

  const posterSel = posters.find((p) => p.id === fPoster);
  const inputClass = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.printsTitle}</h1>
        <p className="text-gray-500 text-sm">{t.printsSubtitle}</p>
      </div>

      {/* Registrar entrada */}
      {formAbierto ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.registerEntry}</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.entryDesign}</label>
            <select value={fPoster} onChange={(e) => { setFPoster(e.target.value); setFCantA4(0); setFCantA3(0); }} className={inputClass}>
              <option value="">{t.selectDesign}</option>
              {posters.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {/* A4 y A3 juntos: una sola entrada para las dos tallas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-yellow-600 mb-1">A4</label>
              <input
                type="number" inputMode="numeric" min={0} value={fCantA4 === 0 ? "" : fCantA4} placeholder="0"
                disabled={!!posterSel && !posterSel.tiene_a4}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFCantA4(Math.max(0, parseInt(e.target.value) || 0))}
                className={`${inputClass} disabled:opacity-30 disabled:bg-gray-50`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-600 mb-1">A3</label>
              <input
                type="number" inputMode="numeric" min={0} value={fCantA3 === 0 ? "" : fCantA3} placeholder="0"
                disabled={!!posterSel && !posterSel.tiene_a3}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFCantA3(Math.max(0, parseInt(e.target.value) || 0))}
                className={`${inputClass} disabled:opacity-30 disabled:bg-gray-50`}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.entryOrigin}</label>
            <div className="flex gap-2">
              {([["taller", t.originWorkshop], ["externo", t.originExternal]] as [Origen, string][]).map(([o, label]) => (
                <button
                  key={o}
                  onClick={() => setFOrigen(o)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${fOrigen === o ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={registrarEntrada}
              disabled={!fPoster || (fCantA4 <= 0 && fCantA3 <= 0) || guardando}
              className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              {guardando ? t.saving : t.saveEntry}
            </button>
            <button onClick={() => setFormAbierto(false)} className="px-4 text-sm text-gray-400">{t.cancel}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setFormAbierto(true)}
          className="w-full py-3 rounded-xl bg-black text-white font-medium text-sm"
        >
          {t.registerEntry}
        </button>
      )}

      {/* Stock actual */}
      {filas.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t.noPrints}</p>
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-2">{tr("totalPrints", { n: totalUnidades })}</p>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_48px_48px_28px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">{t.poster}</span>
              <span className="text-xs font-semibold text-yellow-600 text-center">A4</span>
              <span className="text-xs font-semibold text-blue-600 text-center">A3</span>
              <span />
            </div>
            {filas.map((f, i) => (
              <div key={f.nombre} className={`grid grid-cols-[1fr_48px_48px_28px] gap-2 px-4 py-3 items-center ${i < filas.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{f.nombre}</p>
                  <p className="text-[10px]" style={{ color: f.color }}>{f.serie}</p>
                </div>
                <span className={`text-center text-sm font-bold ${f.a4 > 0 ? "text-gray-900" : "text-gray-300"}`}>{f.a4}</span>
                <span className={`text-center text-sm font-bold ${f.a3 > 0 ? "text-gray-900" : "text-gray-300"}`}>{f.a3}</span>
                <button onClick={() => eliminarPrint(f.posterId, f.nombre)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas entradas */}
      {entradas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-4 pt-4 pb-2">{t.recentEntries}</p>
          {entradas.map((e, i) => (
            <div key={e.id} className={`flex justify-between items-center px-4 py-2.5 gap-2 ${i < entradas.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="min-w-0">
                <p className="text-xs text-gray-700 truncate">{e.posters?.nombre || "—"} · {e.talla}</p>
                <p className="text-[10px] text-gray-400">
                  {e.origen === "taller" ? t.originWorkshop : t.originExternal} · {e.created_at.slice(0, 10)}{e.registrado_por ? ` · ${e.registrado_por}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-emerald-600">+{e.cantidad}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
