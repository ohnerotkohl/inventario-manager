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
  const [verTodasComisiones, setVerTodasComisiones] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

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
        supabase.from("inventario").select("out, sample_falta, caja_id, cantidad"),
        supabase.from("materiales_caja").select("nombre, cajas(nombre)").eq("necesita_restock", true),
        supabase.from("insumos_estudio").select("nombre, cantidad, unidad").eq("necesita_compra", true),
        supabase.from("cajas").select("id, nombre, descripcion"),
        supabase.from("sesiones").select("fecha, trabajador, mercados(nombre)").order("created_at", { ascending: false }).limit(5),
        supabase.from("comisiones").select("id, texto, fecha, mercado, completada").order("created_at", { ascending: false }),
        supabase.from("ideas").select("id, texto, fecha, mercado").order("created_at", { ascending: false }),
      ]);

      const inv = invRes.data || [];
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

  async function toggleComision(id: string, completada: boolean) {
    setComisiones((prev) => prev.map((c) => c.id === id ? { ...c, completada } : c));
    await supabase.from("comisiones").update({ completada }).eq("id", id);
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
          <div className="h-7 bg-gray-200 rounded-lg w-36" />
          <div className="h-4 bg-gray-100 rounded-lg w-52" />
        </div>
        <SkeletonCard />
        <div className="h-14 bg-gray-200 rounded-2xl animate-pulse" />
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
        <h1 className="text-2xl font-bold text-gray-900">{t.dashboard}</h1>
        <p className="text-gray-500 text-sm">{t.dashboardSubtitle}</p>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} />
            {tr("activeAlerts", { n: totalAlertas })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {alertas.out > 0 && (
              <div className="bg-red-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{alertas.out}</p>
                <p className="text-xs text-red-700">{t.soldOut}</p>
              </div>
            )}
            {alertas.stockBajo > 0 && (
              <div className="bg-yellow-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{alertas.stockBajo}</p>
                <p className="text-xs text-yellow-700">{t.lowStock}</p>
              </div>
            )}
            {alertas.sampleFalta > 0 && (
              <div className="bg-orange-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{alertas.sampleFalta}</p>
                <p className="text-xs text-orange-700">{t.missingSamples}</p>
              </div>
            )}
            {alertas.materiales > 0 && (
              <div className="bg-yellow-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{alertas.materiales}</p>
                <p className="text-xs text-yellow-700">{t.boxMaterials}</p>
              </div>
            )}
            {alertas.insumos > 0 && (
              <div className="bg-blue-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{alertas.insumos}</p>
                <p className="text-xs text-blue-700">{t.studioSupplies}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 font-semibold flex items-center justify-center gap-2">
            <CheckCircle size={18} />
            {t.allGood}
          </p>
          <p className="text-green-600 text-sm">{t.noAlerts}</p>
        </div>
      )}

      {/* Lista de compras pendientes */}
      {(materialesPendientes.length > 0 || insumosPendientes.length > 0) && (
        <Link href="/compras" className="block">
          <div className="bg-white border-2 border-red-200 rounded-2xl overflow-hidden hover:border-red-400 transition-colors">
            <div className="bg-red-50 px-4 py-3 flex items-center justify-between">
              <p className="font-bold text-red-700 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
                {t.pendingPurchase}
              </p>
              <span className="text-xs text-red-600 font-semibold">{t.viewList} →</span>
            </div>
            {materialesPendientes.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t.boxMaterialsSection}</p>
                <ul className="space-y-1.5">
                  {materialesPendientes.map((m, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 font-medium flex items-center gap-2">
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
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{t.studioSuppliesSection}</p>
                <ul className="space-y-1.5">
                  {insumosPendientes.map((ins, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 font-medium flex items-center gap-2">
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
        className="flex items-center justify-center gap-3 bg-black text-white rounded-2xl p-4 font-semibold text-lg hover:bg-gray-900 transition-colors"
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
        <h2 className="font-bold text-gray-700 mb-3">{t.boxStatus}</h2>
        <div className="grid grid-cols-2 gap-3">
          {cajas.map((c) => (
            <Link key={c.id} href={`/inventario?caja=${c.nombre.replace(/ /g, '-')}`}>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-400 transition-colors">
                <p className="font-bold text-gray-900">{c.nombre}</p>
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
          <h2 className="font-bold text-gray-700 mb-3">{t.latestSessions}</h2>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {ultimasSesiones.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm text-gray-900">{s.nombre}</p>
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
      {comisiones.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-700">{t.commissionsSection}</h2>
            {comisiones.some((c) => c.completada) && (
              <button
                onClick={() => setVerTodasComisiones((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
              >
                {verTodasComisiones ? "Solo pendientes" : t.allCommissions}
              </button>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
            {comisiones
              .filter((c) => verTodasComisiones || !c.completada)
              .map((c) => (
                <div key={c.id} className={`flex items-start gap-3 px-4 py-3 ${c.completada ? "opacity-50" : ""}`}>
                  <button
                    onClick={() => toggleComision(c.id, !c.completada)}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      c.completada ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-gray-500"
                    }`}
                  >
                    {c.completada && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-gray-900 ${c.completada ? "line-through" : ""}`}>{c.texto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.mercado} · {new Date(c.fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))}
            {comisiones.filter((c) => verTodasComisiones || !c.completada).length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">{t.noCommissions}</p>
            )}
          </div>
        </div>
      )}

      {/* Ideas */}
      {ideas.length > 0 && (
        <div className="pb-6">
          <h2 className="font-bold text-gray-700 mb-3">{t.ideasSection}</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl divide-y divide-amber-100 overflow-hidden">
            {ideas.map((idea) => (
              <div key={idea.id} className="px-4 py-3">
                <p className="text-sm text-amber-900">{idea.texto}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {idea.mercado} · {new Date(idea.fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
