"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SkeletonCard, SkeletonList } from "@/app/components/Skeleton";

interface TopPoster {
  nombre: string;
  serie: string;
  serieColor: string;
  totalA4: number;
  totalA3: number;
  total: number;
}

interface VentasPorMercado {
  mercado: string;
  total: number;
}

interface VentasPorSerie {
  serie: string;
  color: string;
  total: number;
}

interface SesionHistorial {
  id: string;
  fecha: string;
  mercado: string;
  trabajador: string;
  total: number;
  posters: { nombre: string; talla: string; cantidad: number }[];
}

type Tab = "resumen" | "historial";

export default function EstadisticasPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [topPosters, setTopPosters] = useState<TopPoster[]>([]);
  const [porMercado, setPorMercado] = useState<VentasPorMercado[]>([]);
  const [porSerie, setPorSerie] = useState<VentasPorSerie[]>([]);
  const [historial, setHistorial] = useState<SesionHistorial[]>([]);
  const [sesionAbierta, setSesionAbierta] = useState<string | null>(null);
  const [totalVentas, setTotalVentas] = useState(0);
  const [porMes, setPorMes] = useState<number[]>(Array(12).fill(0));
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"30" | "90" | "365" | "todo">("todo");

  useEffect(() => {
    fetchStats();
  }, [periodo]);

  async function fetchStats() {
    setLoading(true);

    const { data } = await supabase
      .from("ventas")
      .select("cantidad, talla, poster_id, sesion_id, posters(nombre, series(nombre, color)), sesiones(id, fecha, trabajador, mercados(nombre))");

    type VentaRow = {
      cantidad: number;
      talla: string;
      poster_id: string;
      sesion_id: string;
      posters: { nombre: string; series: { nombre: string; color: string } | null } | null;
      sesiones: { id: string; fecha: string; trabajador: string; mercados: { nombre: string } | null } | null;
    };
    const ventas = (data || []) as unknown as VentaRow[];

    const ventasFiltradas = periodo !== "todo"
      ? ventas.filter((v) => {
          if (!v.sesiones?.fecha) return false;
          const desde = new Date();
          desde.setDate(desde.getDate() - parseInt(periodo));
          return new Date(v.sesiones.fecha) >= desde;
        })
      : ventas;

    setTotalVentas(ventasFiltradas.reduce((a, v) => a + v.cantidad, 0));

    // Top pósters
    const porPoster: { [id: string]: TopPoster } = {};
    for (const v of ventasFiltradas) {
      if (!v.poster_id || !v.posters) continue;
      if (!porPoster[v.poster_id]) {
        porPoster[v.poster_id] = {
          nombre: v.posters.nombre,
          serie: v.posters.series?.nombre || "—",
          serieColor: v.posters.series?.color || "#6B7280",
          totalA4: 0, totalA3: 0, total: 0,
        };
      }
      if (v.talla === "A4") porPoster[v.poster_id].totalA4 += v.cantidad;
      if (v.talla === "A3") porPoster[v.poster_id].totalA3 += v.cantidad;
      porPoster[v.poster_id].total += v.cantidad;
    }
    setTopPosters(Object.values(porPoster).sort((a, b) => b.total - a.total).slice(0, 20));

    // Por mercado
    const mercadoMap: { [n: string]: number } = {};
    for (const v of ventasFiltradas) {
      const m = v.sesiones?.mercados?.nombre || "—";
      mercadoMap[m] = (mercadoMap[m] || 0) + v.cantidad;
    }
    setPorMercado(Object.entries(mercadoMap).map(([mercado, total]) => ({ mercado, total })).sort((a, b) => b.total - a.total));

    // Por serie
    const serieMap: { [n: string]: { total: number; color: string } } = {};
    for (const v of ventasFiltradas) {
      const s = v.posters?.series?.nombre || "—";
      const c = v.posters?.series?.color || "#6B7280";
      if (!serieMap[s]) serieMap[s] = { total: 0, color: c };
      serieMap[s].total += v.cantidad;
    }
    setPorSerie(Object.entries(serieMap).map(([serie, { total, color }]) => ({ serie, total, color })).sort((a, b) => b.total - a.total));

    // Por mes (siempre sobre todos los datos, sin filtro de periodo)
    const meses = Array(12).fill(0);
    for (const v of ventas) {
      if (!v.sesiones?.fecha) continue;
      const mes = new Date(v.sesiones.fecha).getMonth();
      meses[mes] += v.cantidad;
    }
    setPorMes(meses);

    // Historial por sesión
    const sesionesMap: { [id: string]: SesionHistorial } = {};
    for (const v of ventasFiltradas) {
      if (!v.sesiones) continue;
      const sid = v.sesiones.id;
      if (!sesionesMap[sid]) {
        sesionesMap[sid] = {
          id: sid,
          fecha: v.sesiones.fecha,
          mercado: v.sesiones.mercados?.nombre || "—",
          trabajador: v.sesiones.trabajador,
          total: 0,
          posters: [],
        };
      }
      sesionesMap[sid].total += v.cantidad;
      if (v.posters && v.cantidad > 0) {
        sesionesMap[sid].posters.push({
          nombre: v.posters.nombre,
          talla: v.talla,
          cantidad: v.cantidad,
        });
      }
    }
    setHistorial(
      Object.values(sesionesMap)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    );

    setLoading(false);
  }

  const maxPoster = topPosters[0]?.total || 1;
  const maxMercado = porMercado[0]?.total || 1;
  const maxSerie = porSerie[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-gray-500 text-sm">Ventas y rendimiento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("resumen")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === "resumen" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          📊 Resumen
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === "historial" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          📅 Historial
        </button>
      </div>

      {/* Filtro período */}
      <div className="flex gap-2">
        {[{ val: "30", label: "30 días" }, { val: "90", label: "3 meses" }, { val: "365", label: "1 año" }, { val: "todo", label: "Todo" }].map((p) => (
          <button
            key={p.val}
            onClick={() => setPeriodo(p.val as "30" | "90" | "365" | "todo")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${periodo === p.val ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonList rows={4} />
          <SkeletonList rows={5} />
        </div>
      ) : totalVentas === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📊</p>
          <p>No hay ventas registradas aún</p>
        </div>
      ) : tab === "resumen" ? (
        <>
          {/* Total */}
          <div className="bg-black text-white rounded-2xl p-5 text-center">
            <p className="text-5xl font-bold">{totalVentas}</p>
            <p className="text-gray-400 mt-1">pósters vendidos</p>
          </div>

          {/* Gráfica por mes */}
          {porMes.some((m) => m > 0) && (() => {
            const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
            const maxMes = Math.max(...porMes, 1);
            return (
              <div>
                <h2 className="font-bold text-gray-700 mb-3">Ventas por mes</h2>
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-end gap-1 h-28">
                    {porMes.map((total, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">{total > 0 ? total : ""}</span>
                        <div className="w-full rounded-t-sm bg-black" style={{ height: `${Math.max((total / maxMes) * 80, total > 0 ? 4 : 0)}px` }} />
                        <span className="text-xs text-gray-400">{meses[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Por mercado */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">Por mercado</h2>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              {porMercado.map((m) => (
                <div key={m.mercado}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800">{m.mercado}</span>
                    <span className="text-gray-500">{m.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: `${(m.total / maxMercado) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por serie */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">Por serie</h2>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              {porSerie.map((s) => (
                <div key={s.serie}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800">{s.serie}</span>
                    <span className="text-gray-500">{s.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.total / maxSerie) * 100}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top pósters */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">Top pósters</h2>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {topPosters.map((p, idx) => (
                <div key={p.nombre} className={`flex items-center gap-3 px-4 py-3 ${idx < topPosters.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <span className="text-lg font-bold text-gray-300 w-7 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{p.nombre}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: p.serieColor + "22", color: p.serieColor }}>{p.serie}</span>
                      <span className="text-xs text-gray-400">A4: {p.totalA4} · A3: {p.totalA3}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{p.total}</p>
                    <div className="h-1.5 w-16 bg-gray-100 rounded-full mt-1">
                      <div className="h-full bg-black rounded-full" style={{ width: `${(p.total / maxPoster) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* HISTORIAL */
        <div className="space-y-3">
          {historial.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-2">📅</p>
              <p>No hay sesiones registradas</p>
            </div>
          ) : historial.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                onClick={() => setSesionAbierta(sesionAbierta === s.id ? null : s.id)}
              >
                <div className="text-left">
                  <p className="font-bold text-gray-900">{s.mercado}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {s.trabajador}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{s.total} vendidos</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/sesion/editar?id=${s.id}`); }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg font-medium transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  <span className="text-gray-400">{sesionAbierta === s.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {sesionAbierta === s.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5">
                    <span className="text-xs font-semibold text-gray-400">Póster</span>
                    <span className="text-xs font-semibold text-gray-400">Talla</span>
                    <span className="text-xs font-semibold text-gray-400 text-right">Uds.</span>
                    {s.posters.sort((a, b) => b.cantidad - a.cantidad).map((p, i) => (
                      <>
                        <span key={`n-${i}`} className="text-sm text-gray-800 truncate">{p.nombre}</span>
                        <span key={`t-${i}`} className="text-sm text-gray-500">{p.talla}</span>
                        <span key={`c-${i}`} className="text-sm font-semibold text-gray-900 text-right">{p.cantidad}</span>
                      </>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
