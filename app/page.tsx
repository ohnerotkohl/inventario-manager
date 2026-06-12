"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonCard, SkeletonList } from "@/app/components/Skeleton";
import { AlertTriangle, Check, CheckCircle, Settings, Dot } from "@/app/components/Icons";

interface AlertCounts {
  out: number;
  stockBajo: number;
  sampleFalta: number;
  materiales: number;
  insumos: number;
}

interface AlertDetail {
  nombre: string;
  talla: string;
  caja: string;
  cantidad?: number;
}

interface CajaResumen {
  id: string;
  nombre: string;
  descripcion: string;
  outCount: number;
  stockBajoCount: number;
  sampleCount: number;
}

interface UltimaSesion {
  nombre: string;
  fecha: string;
  trabajador: string;
}

interface ItemCompra {
  nombre: string;
  detalle?: string;
}

interface Comision {
  id: string;
  texto: string;
  fecha: string;
  mercado: string;
  completada: boolean;
}

interface Idea {
  id: string;
  texto: string;
  fecha: string;
  mercado: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, tr } = useLang();
  const [alertas, setAlertas] = useState<AlertCounts>({ out: 0, stockBajo: 0, sampleFalta: 0, materiales: 0, insumos: 0 });
  const [cajas, setCajas] = useState<CajaResumen[]>([]);
  const [ultimasSesiones, setUltimasSesiones] = useState<UltimaSesion[]>([]);
  const [materialesPendientes, setMaterialesPendientes] = useState<ItemCompra[]>([]);
  const [insumosPendientes, setInsumosPendientes] = useState<ItemCompra[]>([]);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editingIdeaText, setEditingIdeaText] = useState("");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [alertaAbierta, setAlertaAbierta] = useState<"out" | "stockBajo" | "sampleFalta" | "materiales" | "insumos" | null>(null);
  const [alertDetails, setAlertDetails] = useState<{ out: AlertDetail[]; stockBajo: AlertDetail[]; sampleFalta: AlertDetail[] }>({ out: [], stockBajo: [], sampleFalta: [] });

  // Prueba dark mode: el fondo oscuro se activa solo mientras estás en Inicio
  useEffect(() => {
    document.body.classList.add("body-dark");
    return () => document.body.classList.remove("body-dark");
  }, []);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url === "your_supabase_url_here") {
      setConfigured(false);
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  async function fetchData() {
    try {
      const [invRes, matRes, insRes, cajasRes, sesRes, comRes, ideasRes] = await Promise.all([
        supabase.from("inventario").select("out, sample_falta, caja_id, cantidad, talla, posters(nombre)"),
        supabase.from("materiales_caja").select("nombre, cajas(nombre)").eq("necesita_restock", true),
        supabase.from("insumos_estudio").select("nombre, cantidad, unidad").eq("necesita_compra", true),
        supabase.from("cajas").select("id, nombre, descripcion"),
        supabase.from("sesiones").select("fecha, trabajador, mercados(nombre)").order("created_at", { ascending: false }).limit(5),
        supabase.from("comisiones").select("id, texto, fecha, mercado, completada").order("created_at", { ascending: false }),
        supabase.from("ideas").select("id, texto, fecha, mercado").order("created_at", { ascending: false }),
      ]);

      type InvRow = { out: boolean; sample_falta: boolean; caja_id: string; cantidad: number; talla: string; posters: { nombre: string } | null };
      const inv = (invRes.data || []) as unknown as InvRow[];
      setAlertas({
        out: inv.filter((i) => i.out).length,
        stockBajo: inv.filter((i) => !i.out && i.cantidad > 0 && i.cantidad < 3).length,
        sampleFalta: inv.filter((i) => i.sample_falta).length,
        materiales: matRes.data?.length || 0,
        insumos: insRes.data?.length || 0,
      });

      type MatRow = { nombre: string; cajas: { nombre: string } | null };
      setMaterialesPendientes(
        ((matRes.data as unknown as MatRow[]) || []).map((m) => ({
          nombre: m.nombre,
          detalle: m.cajas?.nombre,
        }))
      );

      type InsRow = { nombre: string; cantidad: number; unidad: string };
      setInsumosPendientes(
        ((insRes.data as unknown as InsRow[]) || []).map((i) => ({
          nombre: i.nombre,
          detalle: tr("remaining", { qty: i.cantidad, unit: i.unidad }),
        }))
      );

      const cajasData = cajasRes.data || [];
      setCajas(cajasData.map((c) => {
        const cajaInv = inv.filter((i) => i.caja_id === c.id);
        return {
          ...c,
          outCount: cajaInv.filter((i) => i.out).length,
          stockBajoCount: cajaInv.filter((i) => !i.out && i.cantidad > 0 && i.cantidad < 3).length,
          sampleCount: cajaInv.filter((i) => i.sample_falta).length,
        };
      }));

      const cajaNombre = (cajaId: string) => cajasData.find(c => c.id === cajaId)?.nombre || "—";
      setAlertDetails({
        out: inv.filter(i => i.out)
          .map(i => ({ nombre: i.posters?.nombre || "—", talla: i.talla, caja: cajaNombre(i.caja_id) }))
          .sort((a, b) => a.caja.localeCompare(b.caja) || a.nombre.localeCompare(b.nombre)),
        stockBajo: inv.filter(i => !i.out && i.cantidad > 0 && i.cantidad < 3)
          .map(i => ({ nombre: i.posters?.nombre || "—", talla: i.talla, caja: cajaNombre(i.caja_id), cantidad: i.cantidad }))
          .sort((a, b) => (a.cantidad ?? 0) - (b.cantidad ?? 0) || a.caja.localeCompare(b.caja)),
        sampleFalta: inv.filter(i => i.sample_falta)
          .map(i => ({ nombre: i.posters?.nombre || "—", talla: i.talla, caja: cajaNombre(i.caja_id) }))
          .sort((a, b) => a.caja.localeCompare(b.caja) || a.nombre.localeCompare(b.nombre)),
      });

      type SesionRow = { fecha: string; trabajador: string; mercados: { nombre: string } | null };
      setUltimasSesiones(
        (sesRes.data as unknown as SesionRow[] || []).map((s) => ({
          nombre: s.mercados?.nombre || "—",
          fecha: s.fecha,
          trabajador: s.trabajador,
        }))
      );

      setComisiones((comRes.data || []) as Comision[]);
      setIdeas((ideasRes.data || []) as Idea[]);
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }

  async function deleteComision(id: string) {
    setComisiones((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("comisiones").delete().eq("id", id);
  }

  async function deleteIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("ideas").delete().eq("id", id);
  }

  async function saveIdea(id: string) {
    const texto = editingIdeaText.trim();
    if (!texto) return;
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, texto } : i));
    setEditingIdeaId(null);
    await supabase.from("ideas").update({ texto }).eq("id", id);
  }

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-gray-500"><Settings size={48} strokeWidth={1.4} /></div>
        <h2 className="text-xl font-bold">{t.connectSupabase}</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          {t.connectSupabaseDesc}
        </p>
        <div className="bg-gray-100 rounded-xl p-4 text-left text-sm w-full max-w-sm space-y-1">
          <p className="text-gray-700">{t.step1}</p>
          <p className="text-gray-700">{t.step2}</p>
          <p className="text-gray-700">{t.step3}</p>
          <p className="text-gray-700">{t.step4}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-gray-800 rounded-lg w-36" />
          <div className="h-4 bg-gray-800/60 rounded-lg w-52" />
        </div>
        <SkeletonCard />
        <div className="h-14 bg-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  const totalAlertas = alertas.out + alertas.stockBajo + alertas.sampleFalta + alertas.materiales + alertas.insumos;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">{t.dashboard}</h1>
        <p className="text-gray-400 text-sm">{t.dashboardSubtitle}</p>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 ? (
        <div className="bg-red-950/40 border border-red-900/60 rounded-2xl p-4">
          <p className="font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} />
            {tr("activeAlerts", { n: totalAlertas })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {alertas.out > 0 && (
              <button onClick={() => setAlertaAbierta("out")} className="bg-red-900/40 rounded-xl p-3 text-center hover:bg-red-900/60 transition-colors active:scale-95">
                <p className="text-2xl font-bold text-red-400">{alertas.out}</p>
                <p className="text-xs text-red-300">{t.soldOut}</p>
              </button>
            )}
            {alertas.stockBajo > 0 && (
              <button onClick={() => setAlertaAbierta("stockBajo")} className="bg-yellow-900/30 rounded-xl p-3 text-center hover:bg-yellow-900/50 transition-colors active:scale-95">
                <p className="text-2xl font-bold text-yellow-400">{alertas.stockBajo}</p>
                <p className="text-xs text-yellow-300">{t.lowStock}</p>
              </button>
            )}
            {alertas.sampleFalta > 0 && (
              <button onClick={() => setAlertaAbierta("sampleFalta")} className="bg-orange-900/30 rounded-xl p-3 text-center hover:bg-orange-900/50 transition-colors active:scale-95">
                <p className="text-2xl font-bold text-orange-400">{alertas.sampleFalta}</p>
                <p className="text-xs text-orange-300">{t.missingSamples}</p>
              </button>
            )}
            {alertas.materiales > 0 && (
              <button onClick={() => setAlertaAbierta("materiales")} className="bg-yellow-900/30 rounded-xl p-3 text-center hover:bg-yellow-900/50 transition-colors active:scale-95">
                <p className="text-2xl font-bold text-yellow-400">{alertas.materiales}</p>
                <p className="text-xs text-yellow-300">{t.boxMaterials}</p>
              </button>
            )}
            {alertas.insumos > 0 && (
              <button onClick={() => setAlertaAbierta("insumos")} className="bg-blue-900/30 rounded-xl p-3 text-center hover:bg-blue-900/50 transition-colors active:scale-95">
                <p className="text-2xl font-bold text-blue-400">{alertas.insumos}</p>
                <p className="text-xs text-blue-300">{t.studioSupplies}</p>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-green-950/40 border border-green-900/60 rounded-2xl p-4 text-center">
          <p className="text-green-400 font-semibold flex items-center justify-center gap-2">
            <CheckCircle size={18} />
            {t.allGood}
          </p>
          <p className="text-green-500 text-sm">{t.noAlerts}</p>
        </div>
      )}

      {/* Lista de compras pendientes */}
      {(materialesPendientes.length > 0 || insumosPendientes.length > 0) && (
        <Link href="/compras" className="block">
          <div className="bg-gray-900 border-2 border-red-900/60 rounded-2xl overflow-hidden hover:border-red-700 transition-colors">
            <div className="bg-red-950/50 px-4 py-3 flex items-center justify-between">
              <p className="font-bold text-red-400 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
                {t.pendingPurchase}
              </p>
              <span className="text-xs text-red-400 font-semibold">{t.viewList} →</span>
            </div>
            {materialesPendientes.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{t.boxMaterialsSection}</p>
                <ul className="space-y-1.5">
                  {materialesPendientes.map((m, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {m.nombre}
                      </span>
                      {m.detalle && <span className="text-xs text-gray-500">{m.detalle}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insumosPendientes.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{t.studioSuppliesSection}</p>
                <ul className="space-y-1.5">
                  {insumosPendientes.map((ins, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {ins.nombre}
                      </span>
                      {ins.detalle && <span className="text-xs text-gray-500">{ins.detalle}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Acción rápida */}
      <Link
        href="/sesion"
        className="flex items-center justify-center gap-3 bg-white text-black rounded-2xl p-4 font-semibold text-lg hover:bg-gray-200 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        {t.registerSession}
      </Link>

      {/* Estado de cajas */}
      <div>
        <h2 className="font-bold text-gray-300 mb-3">{t.boxStatus}</h2>
        <div className="grid grid-cols-2 gap-3">
          {cajas.map((c) => (
            <Link key={c.id} href={`/inventario?caja=${c.nombre.replace(/ /g, '-')}`}>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-600 transition-colors">
                <p className="font-bold text-gray-100">{c.nombre}</p>
                <p className="text-xs text-gray-500 mb-3 leading-tight">{c.descripcion}</p>
                {c.outCount > 0 && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <Dot color="#dc2626" /> {c.outCount} {t.soldOut}
                  </p>
                )}
                {c.stockBajoCount > 0 && (
                  <p className="text-xs text-yellow-600 flex items-center gap-1.5">
                    <Dot color="#ca8a04" /> {c.stockBajoCount} {t.lowStock}
                  </p>
                )}
                {c.sampleCount > 0 && (
                  <p className="text-xs text-orange-600 flex items-center gap-1.5">
                    <Dot color="#ea580c" /> {c.sampleCount} {t.missingSamples}
                  </p>
                )}
                {c.outCount === 0 && c.stockBajoCount === 0 && c.sampleCount === 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1.5">
                    <Check size={12} /> {t.ok}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Últimas sesiones */}
      {ultimasSesiones.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-300 mb-3">{t.latestSessions}</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
            {ultimasSesiones.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm text-gray-100">{s.nombre}</p>
                  <p className="text-xs text-gray-500">{s.trabajador}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(s.fecha).toLocaleDateString("es-DE", { day: "2-digit", month: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comisiones */}
      <div>
        <h2 className="font-bold text-gray-300 mb-3">{t.commissionsSection}</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 overflow-hidden">
          {comisiones.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500 text-center">{t.noCommissions}</p>
          ) : comisiones.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => deleteComision(c.id)}
                className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-600 flex-shrink-0 flex items-center justify-center hover:border-green-500 hover:bg-green-900/30 transition-colors"
                title={t.markDone}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{c.texto}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {c.mercado} · {new Date(c.fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ideas */}
      <div className="pb-6">
        <h2 className="font-bold text-gray-300 mb-3">{t.ideasSection}</h2>
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl divide-y divide-amber-900/40 overflow-hidden">
          {ideas.length === 0 ? (
            <p className="px-4 py-4 text-sm text-amber-500 text-center">{t.noIdeas}</p>
          ) : ideas.map((idea) => (
            <div key={idea.id} className="px-4 py-3">
              {editingIdeaId === idea.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingIdeaText}
                    onChange={(e) => setEditingIdeaText(e.target.value)}
                    rows={3}
                    className="w-full border border-amber-800 bg-gray-900 !text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveIdea(idea.id)}
                      className="flex-1 bg-amber-500 text-white py-1.5 rounded-lg text-xs font-semibold"
                    >
                      {t.save}
                    </button>
                    <button
                      onClick={() => setEditingIdeaId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-gray-400 bg-gray-800"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-amber-100">{idea.texto}</p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      {idea.mercado} · {new Date(idea.fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditingIdeaId(idea.id); setEditingIdeaText(idea.texto); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-900/40 text-amber-500 transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteIdea(idea.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom sheet detalle de alerta */}
      {alertaAbierta && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setAlertaAbierta(null)}>
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-100 text-lg">
                  {alertaAbierta === "out" && t.soldOut}
                  {alertaAbierta === "stockBajo" && t.lowStock}
                  {alertaAbierta === "sampleFalta" && t.missingSamples}
                  {alertaAbierta === "materiales" && t.boxMaterials}
                  {alertaAbierta === "insumos" && t.studioSupplies}
                </h3>
                <p className="text-xs text-gray-400">
                  {alertaAbierta === "out" && `${alertDetails.out.length} items`}
                  {alertaAbierta === "stockBajo" && `${alertDetails.stockBajo.length} items`}
                  {alertaAbierta === "sampleFalta" && `${alertDetails.sampleFalta.length} items`}
                  {alertaAbierta === "materiales" && `${materialesPendientes.length} items`}
                  {alertaAbierta === "insumos" && `${insumosPendientes.length} items`}
                </p>
              </div>
              <button onClick={() => setAlertaAbierta(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 text-xl font-bold">×</button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 p-4">

              {/* Sold Out */}
              {alertaAbierta === "out" && (
                <div className="bg-gray-950/60 border border-gray-800 rounded-2xl overflow-hidden">
                  {alertDetails.out.map((d, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-3 ${idx < alertDetails.out.length - 1 ? "border-b border-gray-800" : ""}`}>
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <p className="flex-1 text-sm font-medium text-gray-200">{d.nombre}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${d.talla === "A4" ? "bg-yellow-900/40 text-yellow-300" : "bg-blue-900/40 text-blue-300"}`}>{d.talla}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{d.caja}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stock bajo */}
              {alertaAbierta === "stockBajo" && (
                <div className="bg-gray-950/60 border border-gray-800 rounded-2xl overflow-hidden">
                  {alertDetails.stockBajo.map((d, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-3 ${idx < alertDetails.stockBajo.length - 1 ? "border-b border-gray-800" : ""}`}>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg min-w-[28px] text-center ${d.cantidad === 1 ? "bg-red-900/40 text-red-300" : "bg-yellow-900/40 text-yellow-300"}`}>{d.cantidad}</span>
                      <p className="flex-1 text-sm font-medium text-gray-200">{d.nombre}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${d.talla === "A4" ? "bg-yellow-900/40 text-yellow-300" : "bg-blue-900/40 text-blue-300"}`}>{d.talla}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{d.caja}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Samples — agrupar A4+A3 en misma fila */}
              {alertaAbierta === "sampleFalta" && (() => {
                const grouped: { nombre: string; caja: string; a4: boolean; a3: boolean }[] = [];
                const seen = new Map<string, number>();
                for (const d of alertDetails.sampleFalta) {
                  const key = `${d.nombre}|${d.caja}`;
                  if (seen.has(key)) {
                    const entry = grouped[seen.get(key)!];
                    if (d.talla === "A4") entry.a4 = true;
                    if (d.talla === "A3") entry.a3 = true;
                  } else {
                    seen.set(key, grouped.length);
                    grouped.push({ nombre: d.nombre, caja: d.caja, a4: d.talla === "A4", a3: d.talla === "A3" });
                  }
                }
                return (
                  <div className="bg-gray-950/60 border border-gray-800 rounded-2xl overflow-hidden">
                    {grouped.map((d, idx) => (
                      <div key={idx} className={`flex items-center gap-3 px-4 py-3 ${idx < grouped.length - 1 ? "border-b border-gray-800" : ""}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400 flex-shrink-0">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p className="flex-1 text-sm font-medium text-gray-200">{d.nombre}</p>
                        <div className="flex gap-1 flex-shrink-0">
                          {d.a4 && <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-yellow-900/40 text-yellow-300">A4</span>}
                          {d.a3 && <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-300">A3</span>}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{d.caja}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Materiales de caja */}
              {alertaAbierta === "materiales" && (
                <div className="bg-gray-950/60 border border-gray-800 rounded-2xl overflow-hidden">
                  {materialesPendientes.map((m, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-3 ${idx < materialesPendientes.length - 1 ? "border-b border-gray-800" : ""}`}>
                      <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                      <p className="flex-1 text-sm font-medium text-gray-200">{m.nombre}</p>
                      {m.detalle && <span className="text-xs text-gray-400 flex-shrink-0">{m.detalle}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Insumos estudio */}
              {alertaAbierta === "insumos" && (
                <div className="bg-gray-950/60 border border-gray-800 rounded-2xl overflow-hidden">
                  {insumosPendientes.map((ins, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-3 ${idx < insumosPendientes.length - 1 ? "border-b border-gray-800" : ""}`}>
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <p className="flex-1 text-sm font-medium text-gray-200">{ins.nombre}</p>
                      {ins.detalle && <span className="text-xs text-gray-400 flex-shrink-0">{ins.detalle}</span>}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
