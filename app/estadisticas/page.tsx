"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
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

interface MercadoStats {
  mercado: string;
  id: string;
  total: number;
  sesiones: number;
  promedio: number;
  totalAnterior: number;
  semanaActual: number;
  semanaAnterior: number;
  minBajo: number;
  minMedio: number;
  minTop: number;
  topN: number;
  porMes: number[];
  porSemana: number[];
  topPosters: { nombre: string; total: number; a4: number; a3: number }[];
}

interface SesionHistorial {
  id: string;
  fecha: string;
  mercado: string;
  trabajador: string;
  total: number;
  posters: { nombre: string; talla: string; cantidad: number }[];
}

type Tab = "resumen" | "mercados" | "historial";

export default function EstadisticasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, tr } = useLang();
  const [tab, setTab] = useState<Tab>("resumen");
  const [topPosters, setTopPosters] = useState<TopPoster[]>([]);
  const [porMercado, setPorMercado] = useState<VentasPorMercado[]>([]);
  const [porSerie, setPorSerie] = useState<VentasPorSerie[]>([]);
  const [historial, setHistorial] = useState<SesionHistorial[]>([]);
  const [sesionAbierta, setSesionAbierta] = useState<string | null>(null);
  const [totalVentas, setTotalVentas] = useState(0);
  const [porMes, setPorMes] = useState<number[]>(Array(12).fill(0));
  const [sinVentas, setSinVentas] = useState<{ nombre: string; serie: string; serieColor: string }[]>([]);
  const [porMercadoDetalle, setPorMercadoDetalle] = useState<{ mercado: string; total: number; topPosters: { nombre: string; total: number; a4: number; a3: number }[] }[]>([]);
  const [comparativa, setComparativa] = useState<{ actual: number; anterior: number } | null>(null);
  const [mercadoAbierto, setMercadoAbierto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"30" | "90" | "365" | "todo">("todo");
  const [showAllPosters, setShowAllPosters] = useState(false);
  const [mercadoStats, setMercadoStats] = useState<MercadoStats[]>([]);
  const [mercadoSeleccionado, setMercadoSeleccionado] = useState<string | null>(null);
  const [restockMinsEdit, setRestockMinsEdit] = useState<{ id: string; minBajo: number; minMedio: number; minTop: number; topN: number } | null>(null);
  const [savingMins, setSavingMins] = useState(false);
  const [saveMinsOk, setSaveMinsOk] = useState(false);
  const [saveMinsError, setSaveMinsError] = useState("");
  const [mercadoChartMode, setMercadoChartMode] = useState<"semana" | "mes">("semana");

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    fetchStats();
  }, [periodo, user]);

  async function saveMercadoMins() {
    if (!restockMinsEdit) return;
    setSavingMins(true);
    setSaveMinsError("");
    const { error } = await supabase
      .from("mercados")
      .update({ min_bajo: restockMinsEdit.minBajo, min_medio: restockMinsEdit.minMedio, min_top: restockMinsEdit.minTop, top_n: restockMinsEdit.topN })
      .eq("id", restockMinsEdit.id);
    setSavingMins(false);
    if (error) { setSaveMinsError(error.message); }
    else { setSaveMinsOk(true); setTimeout(() => setSaveMinsOk(false), 2000); fetchStats(); }
  }

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
          return new Date(v.sesiones.fecha + "T12:00:00") >= desde;
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
    const allPosters = Object.values(porPoster).sort((a, b) => b.total - a.total);
    setTopPosters(allPosters);

    // Posters con inventario pero sin ventas en el período + config de mercados
    const [postersRes, mercadosRes] = await Promise.all([
      supabase.from("posters").select("nombre, activo, series(nombre, color)").eq("activo", true),
      supabase.from("mercados").select("id, nombre, min_bajo, min_medio, min_top, top_n"),
    ]);
    const { data: todosPosters } = postersRes;
    type MercConf = { id: string; nombre: string; min_bajo: number; min_medio: number; min_top: number; top_n: number };
    const mercadosConf = (mercadosRes.data || []) as unknown as MercConf[];
    type PosterRow = { nombre: string; series: { nombre: string; color: string } | null };
    const vendidosSet = new Set(Object.keys(porPoster).map((id) => porPoster[id].nombre));
    setSinVentas(
      ((todosPosters || []) as unknown as PosterRow[])
        .filter((p) => !vendidosSet.has(p.nombre))
        .map((p) => ({ nombre: p.nombre, serie: p.series?.nombre || "—", serieColor: p.series?.color || "#6B7280" }))
    );

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

    // Comparativa vs período anterior
    if (periodo !== "todo") {
      const hoy = new Date();
      let desdeActual: Date, hastaActual: Date, desdeAnterior: Date, hastaAnterior: Date;

      if (periodo === "30") {
        // Mes natural actual vs mes natural anterior
        desdeActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        hastaActual = hoy;
        desdeAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hastaAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      } else {
        const dias = parseInt(periodo);
        desdeActual = new Date(); desdeActual.setDate(hoy.getDate() - dias);
        hastaActual = hoy;
        desdeAnterior = new Date(); desdeAnterior.setDate(hoy.getDate() - dias * 2);
        hastaAnterior = new Date(); hastaAnterior.setDate(hoy.getDate() - dias - 1);
      }

      const totalActual = ventas
        .filter((v) => {
          if (!v.sesiones?.fecha) return false;
          const f = new Date(v.sesiones.fecha + "T12:00:00");
          return f >= desdeActual && f <= hastaActual;
        })
        .reduce((a, v) => a + v.cantidad, 0);
      const totalAnterior = ventas
        .filter((v) => {
          if (!v.sesiones?.fecha) return false;
          const f = new Date(v.sesiones.fecha + "T12:00:00");
          return f >= desdeAnterior && f <= hastaAnterior;
        })
        .reduce((a, v) => a + v.cantidad, 0);
      setComparativa({ actual: totalActual, anterior: totalAnterior });
    } else {
      setComparativa(null);
    }

    // Detalle por mercado
    const mercadoDetalleMap: { [m: string]: { [nombre: string]: { total: number; a4: number; a3: number } } } = {};
    for (const v of ventasFiltradas) {
      const m = v.sesiones?.mercados?.nombre || "—";
      const nombre = v.posters?.nombre || "—";
      if (!mercadoDetalleMap[m]) mercadoDetalleMap[m] = {};
      if (!mercadoDetalleMap[m][nombre]) mercadoDetalleMap[m][nombre] = { total: 0, a4: 0, a3: 0 };
      mercadoDetalleMap[m][nombre].total += v.cantidad;
      if (v.talla === "A4") mercadoDetalleMap[m][nombre].a4 += v.cantidad;
      if (v.talla === "A3") mercadoDetalleMap[m][nombre].a3 += v.cantidad;
    }
    setPorMercadoDetalle(
      Object.entries(mercadoDetalleMap).map(([mercado, postersMap]) => ({
        mercado,
        total: Object.values(postersMap).reduce((a, b) => a + b.total, 0),
        topPosters: Object.entries(postersMap)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([nombre, d]) => ({ nombre, total: d.total, a4: d.a4, a3: d.a3 })),
      })).sort((a, b) => b.total - a.total)
    );

    // Estadísticas detalladas por mercado (con comparativa período anterior)
    {
      // Compute period boundaries for per-market comparison
      let desdeAnteriorMerc: Date | null = null;
      let hastaAnteriorMerc: Date | null = null;
      if (periodo !== "todo") {
        const hoy = new Date();
        if (periodo === "30") {
          desdeAnteriorMerc = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
          hastaAnteriorMerc = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        } else {
          const dias = parseInt(periodo);
          desdeAnteriorMerc = new Date(); desdeAnteriorMerc.setDate(hoy.getDate() - dias * 2);
          hastaAnteriorMerc = new Date(); hastaAnteriorMerc.setDate(hoy.getDate() - dias - 1);
        }
      }

      // Semana pasada (lun–dom completa) y semana antepasada (la anterior a esa)
      const hoyW = new Date();
      const diasDesdeElLunes = hoyW.getDay() === 0 ? 6 : hoyW.getDay() - 1;
      const lunesActual = new Date(hoyW);
      lunesActual.setDate(hoyW.getDate() - diasDesdeElLunes);
      lunesActual.setHours(0, 0, 0, 0);
      // Semana pasada: lunes hace 7 días → domingo (ayer si hoy es lunes)
      const lunesPasado = new Date(lunesActual);
      lunesPasado.setDate(lunesActual.getDate() - 7);
      const domingoPasado = new Date(lunesActual);
      domingoPasado.setDate(lunesActual.getDate() - 1);
      domingoPasado.setHours(23, 59, 59, 999);
      // Semana antepasada: lunes hace 14 días → domingo hace 8 días
      const lunesAntepasado = new Date(lunesActual);
      lunesAntepasado.setDate(lunesActual.getDate() - 14);
      const domingoAntepasado = new Date(lunesActual);
      domingoAntepasado.setDate(lunesActual.getDate() - 8);
      domingoAntepasado.setHours(23, 59, 59, 999);

      // Estructura de las últimas 16 semanas para la gráfica semanal
      const hoyGraf = new Date();
      const diasLunesGraf = hoyGraf.getDay() === 0 ? 6 : hoyGraf.getDay() - 1;
      const lunesActualGraf = new Date(hoyGraf);
      lunesActualGraf.setDate(hoyGraf.getDate() - diasLunesGraf);
      lunesActualGraf.setHours(0, 0, 0, 0);
      const N_SEMANAS = 16;
      const semanasGraf = Array.from({ length: N_SEMANAS }, (_, i) => {
        const start = new Date(lunesActualGraf);
        start.setDate(lunesActualGraf.getDate() - (N_SEMANAS - 1 - i) * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      });
      const anoActualGraf = hoyGraf.getFullYear();

      type MercadoAcc = {
        total: number;
        sesiones: Set<string>;
        topPosters: { [n: string]: { total: number; a4: number; a3: number } };
        totalAnterior: number;
        semanaActual: number;
        semanaAnterior: number;
        porMes: number[];
        porSemana: number[];
      };
      const acc: { [m: string]: MercadoAcc } = {};

      for (const v of ventasFiltradas) {
        const m = v.sesiones?.mercados?.nombre || "—";
        const sid = v.sesiones?.id || "";
        if (!acc[m]) acc[m] = { total: 0, sesiones: new Set(), topPosters: {}, totalAnterior: 0, semanaActual: 0, semanaAnterior: 0, porMes: Array(12).fill(0), porSemana: Array(N_SEMANAS).fill(0) };
        acc[m].total += v.cantidad;
        if (sid) acc[m].sesiones.add(sid);
        const nombre = v.posters?.nombre || "—";
        if (!acc[m].topPosters[nombre]) acc[m].topPosters[nombre] = { total: 0, a4: 0, a3: 0 };
        acc[m].topPosters[nombre].total += v.cantidad;
        if (v.talla === "A4") acc[m].topPosters[nombre].a4 += v.cantidad;
        if (v.talla === "A3") acc[m].topPosters[nombre].a3 += v.cantidad;
      }

      if (desdeAnteriorMerc && hastaAnteriorMerc) {
        for (const v of ventas) {
          if (!v.sesiones?.fecha) continue;
          const f = new Date(v.sesiones.fecha + "T12:00:00");
          if (f >= desdeAnteriorMerc && f <= hastaAnteriorMerc) {
            const m = v.sesiones?.mercados?.nombre || "—";
            if (!acc[m]) acc[m] = { total: 0, sesiones: new Set(), topPosters: {}, totalAnterior: 0, semanaActual: 0, semanaAnterior: 0, porMes: Array(12).fill(0), porSemana: Array(N_SEMANAS).fill(0) };
            acc[m].totalAnterior += v.cantidad;
          }
        }
      }

      // Comparativa semanal + gráficas: siempre desde todos los datos (no filtrado por periodo)
      for (const v of ventas) {
        if (!v.sesiones?.fecha) continue;
        const f = new Date(v.sesiones.fecha + "T12:00:00");
        const m = v.sesiones?.mercados?.nombre || "—";
        if (!acc[m]) acc[m] = { total: 0, sesiones: new Set(), topPosters: {}, totalAnterior: 0, semanaActual: 0, semanaAnterior: 0, porMes: Array(12).fill(0), porSemana: Array(N_SEMANAS).fill(0) };
        if (f >= lunesPasado && f <= domingoPasado) acc[m].semanaActual += v.cantidad;
        if (f >= lunesAntepasado && f <= domingoAntepasado) acc[m].semanaAnterior += v.cantidad;
        // Gráfica mensual (año actual)
        if (f.getFullYear() === anoActualGraf) acc[m].porMes[f.getMonth()] += v.cantidad;
        // Gráfica semanal (últimas N_SEMANAS)
        for (let wi = 0; wi < N_SEMANAS; wi++) {
          if (f >= semanasGraf[wi].start && f <= semanasGraf[wi].end) {
            acc[m].porSemana[wi] += v.cantidad;
            break;
          }
        }
      }

      setMercadoStats(
        Object.entries(acc).map(([mercado, d]) => {
          const conf = mercadosConf.find(c => c.nombre === mercado);
          return {
            mercado,
            id: conf?.id || "",
            total: d.total,
            sesiones: d.sesiones.size,
            promedio: d.sesiones.size > 0 ? Math.round((d.total / d.sesiones.size) * 10) / 10 : 0,
            totalAnterior: d.totalAnterior,
            semanaActual: d.semanaActual,
            semanaAnterior: d.semanaAnterior,
            minBajo: conf?.min_bajo ?? 3,
            minMedio: conf?.min_medio ?? 4,
            minTop: conf?.min_top ?? 8,
            topN: conf?.top_n ?? 5,
            porMes: d.porMes,
            porSemana: d.porSemana,
            topPosters: Object.entries(d.topPosters)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([nombre, vals]) => ({ nombre, ...vals })),
          };
        }).sort((a, b) => b.total - a.total)
      );
    }

    // Por mes (año actual, sin filtro de periodo — no mezclar años)
    const meses = Array(12).fill(0);
    const anoActualMes = new Date().getFullYear();
    for (const v of ventas) {
      if (!v.sesiones?.fecha) continue;
      const fMes = new Date(v.sesiones.fecha + "T12:00:00");
      if (fMes.getFullYear() !== anoActualMes) continue;
      meses[fMes.getMonth()] += v.cantidad;
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
  const semanas = periodo !== "todo" ? parseInt(periodo) / 7 : null;
  const maxMercado = porMercado[0]?.total || 1;
  const maxSerie = porSerie[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.statsTitle}</h1>
        <p className="text-gray-500 text-sm">{t.statsSubtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("resumen")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tab === "resumen" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          {t.summary}
        </button>
        <button
          onClick={() => { setTab("mercados"); setMercadoSeleccionado(null); }}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tab === "mercados" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          {t.byMarket}
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tab === "historial" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {t.history}
        </button>
      </div>

      {/* Filtro período */}
      <div className="flex gap-2">
        {[{ val: "30", label: t.days30 }, { val: "90", label: t.months3 }, { val: "365", label: t.year1 }, { val: "todo", label: t.all }].map((p) => (
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
          <div className="flex justify-center mb-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          </div>
          <p>{t.noSales}</p>
        </div>
      ) : tab === "resumen" ? (
        <>
          {/* Total */}
          <div className="bg-black text-white rounded-2xl p-5 text-center">
            <p className="text-5xl font-bold">{totalVentas}</p>
            <p className="text-gray-400 mt-1">{t.postersSold}</p>
          </div>

          {/* Comparativa vs período anterior */}
          {comparativa && (() => {
            const fmt = (d: Date) => d.toLocaleDateString("es-DE", { day: "numeric", month: "short" });
            const hoy = new Date();
            const esMes = periodo === "30";
            const labelActual = esMes ? "Este mes" : `Últimos ${periodo} días`;
            const labelAnterior = esMes ? "Mes anterior" : `${periodo} días antes`;
            const desdeActual = esMes ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : new Date(new Date().setDate(hoy.getDate() - parseInt(periodo)));
            const desdeAnterior = esMes ? new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1) : new Date(new Date().setDate(hoy.getDate() - parseInt(periodo) * 2));
            const hastaAnterior = esMes ? new Date(hoy.getFullYear(), hoy.getMonth(), 0) : new Date(new Date().setDate(hoy.getDate() - parseInt(periodo) - 1));
            return (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Comparativa de períodos</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center bg-gray-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-gray-900">{comparativa.actual}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{labelActual}</p>
                    <p className="text-xs text-gray-400">{fmt(desdeActual)} – {fmt(hoy)}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-xl p-3">
                    <p className="text-2xl font-bold text-gray-400">{comparativa.anterior}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{labelAnterior}</p>
                    <p className="text-xs text-gray-400">{fmt(desdeAnterior)} – {fmt(hastaAnterior)}</p>
                  </div>
                </div>
                {comparativa.anterior > 0 && (() => {
                  const cambio = ((comparativa.actual - comparativa.anterior) / comparativa.anterior) * 100;
                  const sube = cambio >= 0;
                  return (
                    <div className={`mt-3 text-center py-2 rounded-xl text-sm font-semibold ${sube ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {sube ? "▲" : "▼"} {Math.abs(cambio).toFixed(1)}% {sube ? "más que el período anterior" : "menos que el período anterior"}
                    </div>
                  );
                })()}
                {comparativa.anterior === 0 && comparativa.actual > 0 && (
                  <div className="mt-3 text-center py-2 rounded-xl text-sm text-gray-400">
                    Sin datos en el período anterior
                  </div>
                )}
              </div>
            );
          })()}

          {/* Gráfica por mes */}
          {porMes.some((m) => m > 0) && (() => {
            const maxMes = Math.max(...porMes, 1);
            return (
              <div>
                <h2 className="font-bold text-gray-700 mb-3">{t.salesByMonth}</h2>
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-end gap-1 h-28">
                    {porMes.map((total, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-500">{total > 0 ? total : ""}</span>
                        <div className="w-full rounded-t-sm bg-black" style={{ height: `${Math.max((total / maxMes) * 80, total > 0 ? 4 : 0)}px` }} />
                        <span className="text-xs text-gray-400">{t.months[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Por mercado */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3">{t.byMarket}</h2>
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
            <h2 className="font-bold text-gray-700 mb-3">{t.bySeries}</h2>
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

          {/* Detalle por mercado */}
          {porMercadoDetalle.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-700 mb-3">Top por mercado</h2>
              <div className="space-y-2">
                {porMercadoDetalle.map((m) => (
                  <div key={m.mercado} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setMercadoAbierto(mercadoAbierto === m.mercado ? null : m.mercado)}
                    >
                      <span className="font-semibold text-gray-900">{m.mercado}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{m.total} vendidos</span>
                        <span className="text-gray-400 text-xs">{mercadoAbierto === m.mercado ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {mercadoAbierto === m.mercado && (
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {m.topPosters.map((p, idx) => (
                          <div key={p.nombre} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="text-xs font-bold text-gray-300 w-5 text-right">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 truncate">{p.nombre}</p>
                              <p className="text-xs text-gray-400">A4: {p.a4} · A3: {p.a3}</p>
                            </div>
                            <span className="font-bold text-sm text-gray-900">{p.total}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top pósters / Ranking completo */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-700">
                {showAllPosters ? `Ranking completo (${topPosters.length})` : t.topPosters}
              </h2>
              {topPosters.length > 20 && (
                <button
                  onClick={() => setShowAllPosters((v) => !v)}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                >
                  {showAllPosters ? "Ver top 20" : `Ver todos (${topPosters.length})`}
                </button>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {(showAllPosters ? topPosters : topPosters.slice(0, 20)).map((p, idx) => (
                <div key={p.nombre} className={`flex items-center gap-3 px-4 py-3 ${idx < (showAllPosters ? topPosters.length : Math.min(topPosters.length, 20)) - 1 ? "border-b border-gray-100" : ""}`}>
                  <span className={`text-sm font-bold w-7 text-right ${idx < 3 ? "text-gray-900" : "text-gray-300"}`}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{p.nombre}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: p.serieColor + "22", color: p.serieColor }}>{p.serie}</span>
                      <span className="text-xs text-gray-400">A4: {p.totalA4} · A3: {p.totalA3}</span>
                      {semanas && <span className="text-xs text-blue-500 font-medium">{(p.total / semanas).toFixed(1)}/sem</span>}
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

          {/* Sin ventas en el período */}
          {sinVentas.length > 0 && (
            <div className="pb-6">
              <h2 className="font-bold text-gray-700 mb-1">Sin ventas en este período</h2>
              <p className="text-xs text-gray-400 mb-3">{sinVentas.length} diseños activos sin ninguna venta registrada</p>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                {sinVentas.map((p, idx) => (
                  <div key={p.nombre} className={`flex items-center gap-3 px-4 py-2.5 ${idx < sinVentas.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">{p.nombre}</p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: p.serieColor + "22", color: p.serieColor }}>{p.serie}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : tab === "mercados" ? (
        /* MERCADOS */
        <div className="space-y-4">
          {mercadoSeleccionado === null ? (
            /* Lista de mercados */
            mercadoStats.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="flex justify-center mb-2">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <p>{t.noSales}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mercadoStats.map((m) => (
                  <button
                    key={m.mercado}
                    onClick={() => {
                      setMercadoSeleccionado(m.mercado);
                      setRestockMinsEdit({ id: m.id, minBajo: m.minBajo, minMedio: m.minMedio, minTop: m.minTop, topN: m.topN });
                      setSaveMinsOk(false);
                      setSaveMinsError("");
                    }}
                    className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{m.mercado}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{m.sesiones} sesiones · {m.promedio} vendidos/sesión en promedio</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-lg">{m.total}</p>
                        {periodo !== "todo" && m.totalAnterior > 0 && (() => {
                          const cambio = ((m.total - m.totalAnterior) / m.totalAnterior) * 100;
                          const sube = cambio >= 0;
                          return (
                            <p className={`text-xs font-semibold ${sube ? "text-green-600" : "text-red-500"}`}>
                              {sube ? "▲" : "▼"} {Math.abs(cambio).toFixed(0)}%
                            </p>
                          );
                        })()}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 flex-shrink-0">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (() => {
            /* Detalle de mercado */
            const m = mercadoStats.find((s) => s.mercado === mercadoSeleccionado);
            if (!m) return null;
            const maxTop = m.topPosters[0]?.total || 1;
            return (
              <div className="space-y-4">
                {/* Back */}
                <button
                  onClick={() => setMercadoSeleccionado(null)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  {t.byMarket}
                </button>

                <h2 className="text-xl font-bold text-gray-900">{m.mercado}</h2>

                {/* 3 tarjetas de métricas */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-black text-white rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold">{m.total}</p>
                    <p className="text-xs text-gray-400 mt-1">vendidos</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{m.sesiones}</p>
                    <p className="text-xs text-gray-400 mt-1">sesiones</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{m.promedio}</p>
                    <p className="text-xs text-gray-400 mt-1">promedio/sesión</p>
                  </div>
                </div>

                {/* Gráfica de evolución */}
                {(() => {
                  const datos = mercadoChartMode === "mes" ? m.porMes : m.porSemana;
                  const maxVal = Math.max(...datos, 1);
                  // Etiquetas según modo
                  let labels: string[];
                  if (mercadoChartMode === "mes") {
                    labels = t.months;
                  } else {
                    // Reconstruir etiquetas de semanas (lunes de cada semana)
                    const hoyL = new Date();
                    const dL = hoyL.getDay() === 0 ? 6 : hoyL.getDay() - 1;
                    const lunesL = new Date(hoyL);
                    lunesL.setDate(hoyL.getDate() - dL);
                    lunesL.setHours(0,0,0,0);
                    labels = Array.from({ length: 16 }, (_, i) => {
                      const d = new Date(lunesL);
                      d.setDate(lunesL.getDate() - (15 - i) * 7);
                      return d.toLocaleDateString("es-DE", { day: "numeric", month: "short" });
                    });
                  }
                  const tieneData = datos.some(v => v > 0);
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-700">Evolución de ventas</h3>
                        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => setMercadoChartMode("semana")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mercadoChartMode === "semana" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                          >
                            Semanas
                          </button>
                          <button
                            onClick={() => setMercadoChartMode("mes")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mercadoChartMode === "mes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                          >
                            Meses
                          </button>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl p-4">
                        {!tieneData ? (
                          <p className="text-sm text-gray-400 text-center py-4">Sin datos para este período</p>
                        ) : (
                          <div className="flex items-end gap-0.5" style={{ height: "96px" }}>
                            {datos.map((val, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                                {val > 0 && (
                                  <span className="text-[9px] text-gray-500 leading-none">{val}</span>
                                )}
                                <div
                                  className="w-full rounded-t-sm bg-black"
                                  style={{ height: `${Math.max((val / maxVal) * 68, val > 0 ? 3 : 0)}px` }}
                                />
                                <span
                                  className="text-[9px] text-gray-400 leading-none truncate w-full text-center"
                                  style={{ fontSize: mercadoChartMode === "semana" ? "8px" : "9px" }}
                                >
                                  {labels[i]}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Comparativa semanal — siempre visible */}
                {(() => {
                  const hoyWR = new Date();
                  const diasWR = hoyWR.getDay() === 0 ? 6 : hoyWR.getDay() - 1;
                  const lunesActualR = new Date(hoyWR); lunesActualR.setDate(hoyWR.getDate() - diasWR); lunesActualR.setHours(0,0,0,0);
                  const lunesPasadoR = new Date(lunesActualR); lunesPasadoR.setDate(lunesActualR.getDate() - 7);
                  const domPasadoR = new Date(lunesActualR); domPasadoR.setDate(lunesActualR.getDate() - 1);
                  const lunesAntepasadoR = new Date(lunesActualR); lunesAntepasadoR.setDate(lunesActualR.getDate() - 14);
                  const domAntepasadoR = new Date(lunesActualR); domAntepasadoR.setDate(lunesActualR.getDate() - 8);
                  const fmt = (d: Date) => d.toLocaleDateString("es-DE", { day: "numeric", month: "short" });
                  const cambioSem = m.semanaAnterior > 0
                    ? ((m.semanaActual - m.semanaAnterior) / m.semanaAnterior) * 100
                    : null;
                  const subeSem = cambioSem !== null && cambioSem >= 0;
                  return (
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Comparativa semanal</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-2xl font-bold text-gray-900">{m.semanaActual}</p>
                          <p className="text-xs text-gray-500 mt-1 font-medium">Semana pasada</p>
                          <p className="text-xs text-gray-400">{fmt(lunesPasadoR)} – {fmt(domPasadoR)}</p>
                        </div>
                        <div className="text-center bg-gray-50 rounded-xl p-3">
                          <p className="text-2xl font-bold text-gray-400">{m.semanaAnterior}</p>
                          <p className="text-xs text-gray-500 mt-1 font-medium">Semana antepasada</p>
                          <p className="text-xs text-gray-400">{fmt(lunesAntepasadoR)} – {fmt(domAntepasadoR)}</p>
                        </div>
                      </div>
                      {cambioSem !== null && (
                        <div className={`mt-3 text-center py-2 rounded-xl text-sm font-semibold ${subeSem ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {subeSem ? "▲" : "▼"} {Math.abs(cambioSem).toFixed(1)}% {subeSem ? "más que la semana antepasada" : "menos que la semana antepasada"}
                        </div>
                      )}
                      {m.semanaAnterior === 0 && m.semanaActual === 0 && (
                        <div className="mt-3 text-center py-2 rounded-xl text-sm text-gray-400">
                          Sin ventas en ninguna de las dos semanas
                        </div>
                      )}
                      {m.semanaAnterior === 0 && m.semanaActual > 0 && (
                        <div className="mt-3 text-center py-2 rounded-xl text-sm text-gray-400">
                          Sin ventas la semana antepasada
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comparativa vs período anterior */}
                {periodo !== "todo" && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Comparativa de períodos</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center bg-gray-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-gray-900">{m.total}</p>
                        <p className="text-xs text-gray-500 mt-1 font-medium">{periodo === "30" ? "Este mes" : `Últimos ${periodo} días`}</p>
                      </div>
                      <div className="text-center bg-gray-50 rounded-xl p-3">
                        <p className="text-2xl font-bold text-gray-400">{m.totalAnterior}</p>
                        <p className="text-xs text-gray-500 mt-1 font-medium">{periodo === "30" ? "Mes anterior" : `${periodo} días antes`}</p>
                      </div>
                    </div>
                    {m.totalAnterior > 0 && (() => {
                      const cambio = ((m.total - m.totalAnterior) / m.totalAnterior) * 100;
                      const sube = cambio >= 0;
                      return (
                        <div className={`mt-3 text-center py-2 rounded-xl text-sm font-semibold ${sube ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {sube ? "▲" : "▼"} {Math.abs(cambio).toFixed(1)}% {sube ? "más que el período anterior" : "menos que el período anterior"}
                        </div>
                      );
                    })()}
                    {m.totalAnterior === 0 && (
                      <div className="mt-3 text-center py-2 rounded-xl text-sm text-gray-400">
                        Sin datos en el período anterior
                      </div>
                    )}
                  </div>
                )}

                {/* Top pósters del mercado */}
                {m.topPosters.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-700 mb-3">{t.topPosters}</h3>
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      {m.topPosters.map((p, idx) => (
                        <div key={p.nombre} className={`flex items-center gap-3 px-4 py-3 ${idx < m.topPosters.length - 1 ? "border-b border-gray-100" : ""}`}>
                          <span className={`text-sm font-bold w-7 text-right flex-shrink-0 ${idx < 3 ? "text-gray-900" : "text-gray-300"}`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{p.nombre}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {idx < m.topN && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md">⭐ top {idx + 1}</span>}
                              <span className="text-xs text-gray-400">A4: {p.a4} · A3: {p.a3}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-gray-900">{p.total}</p>
                            <div className="h-1.5 w-16 bg-gray-100 rounded-full mt-1">
                              <div className="h-full bg-black rounded-full" style={{ width: `${(p.total / maxTop) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mínimos de restock */}
                {restockMinsEdit && restockMinsEdit.id === m.id && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 pb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Mínimos de restock</p>
                    <p className="text-xs text-gray-400 mb-4">El tab Imprimir en Restock usará estos valores para calcular cuánto imprimir.</p>

                    {/* Top N */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-700 mb-1">⭐ N° de top sellers</p>
                        <p className="text-xs text-gray-400 mb-1.5">Cuántos pósters se consideran "top" (por ventas en este mercado)</p>
                      </div>
                      <input
                        type="number" inputMode="numeric" min={1} max={20}
                        value={restockMinsEdit.topN}
                        onChange={(e) => setRestockMinsEdit(prev => prev ? { ...prev, topN: parseInt(e.target.value) || 1 } : null)}
                        onFocus={(e) => e.target.select()}
                        className="w-16 text-center border-2 border-amber-200 bg-amber-50 rounded-xl py-2 text-sm font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Tres mínimos */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center">
                        <p className="text-xs font-semibold text-amber-700 mb-1.5">⭐ Top {restockMinsEdit.topN}</p>
                        <input
                          type="number" inputMode="numeric" min={1} max={50}
                          value={restockMinsEdit.minTop}
                          onChange={(e) => setRestockMinsEdit(prev => prev ? { ...prev, minTop: parseInt(e.target.value) || 1 } : null)}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-center border-2 border-amber-200 bg-amber-50 rounded-xl py-2.5 text-lg font-bold focus:outline-none focus:border-amber-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">mínimo</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-blue-600 mb-1.5">↗ Con ventas</p>
                        <input
                          type="number" inputMode="numeric" min={1} max={50}
                          value={restockMinsEdit.minMedio}
                          onChange={(e) => setRestockMinsEdit(prev => prev ? { ...prev, minMedio: parseInt(e.target.value) || 1 } : null)}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-center border-2 border-blue-200 bg-blue-50 rounded-xl py-2.5 text-lg font-bold focus:outline-none focus:border-blue-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">mínimo</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">— Sin ventas</p>
                        <input
                          type="number" inputMode="numeric" min={0} max={50}
                          value={restockMinsEdit.minBajo}
                          onChange={(e) => setRestockMinsEdit(prev => prev ? { ...prev, minBajo: parseInt(e.target.value) || 0 } : null)}
                          onFocus={(e) => e.target.select()}
                          className="w-full text-center border-2 border-gray-200 bg-gray-50 rounded-xl py-2.5 text-lg font-bold focus:outline-none focus:border-gray-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">mínimo</p>
                      </div>
                    </div>

                    <button
                      onClick={saveMercadoMins}
                      disabled={savingMins}
                      className={`w-full py-3 rounded-2xl font-semibold text-sm transition-colors disabled:opacity-40 ${saveMinsOk ? "bg-green-600 text-white" : "bg-black text-white hover:bg-gray-900"}`}
                    >
                      {savingMins ? "Guardando..." : saveMinsOk ? "✓ Guardado" : "Guardar mínimos"}
                    </button>
                    {saveMinsError && <p className="text-xs text-red-500 mt-2 text-center">{saveMinsError}</p>}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* HISTORIAL */
        <div className="space-y-3">
          {historial.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="flex justify-center mb-2">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p>{t.noSessions}</p>
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
                  <span className="font-bold text-gray-900">{tr("sold", { n: s.total })}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/sesion/editar?id=${s.id}`); }}
                    className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg font-medium transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {t.edit}
                  </button>
                  <span className="text-gray-400">{sesionAbierta === s.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {sesionAbierta === s.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="grid grid-cols-[1fr_40px_40px] gap-x-3 gap-y-1.5">
                    <span className="text-xs font-semibold text-gray-400">{t.poster}</span>
                    <span className="text-xs font-semibold text-gray-400 text-center">A4</span>
                    <span className="text-xs font-semibold text-gray-400 text-center">A3</span>
                    {Object.entries(
                      s.posters.reduce((acc, p) => {
                        acc[p.nombre] = acc[p.nombre] || {};
                        if (p.talla === "A4") acc[p.nombre].a4 = (acc[p.nombre].a4 || 0) + p.cantidad;
                        if (p.talla === "A3") acc[p.nombre].a3 = (acc[p.nombre].a3 || 0) + p.cantidad;
                        return acc;
                      }, {} as { [n: string]: { a4?: number; a3?: number } })
                    ).sort((a, b) => Math.max(b[1].a4||0, b[1].a3||0) - Math.max(a[1].a4||0, a[1].a3||0))
                      .map(([nombre, vals], i) => (
                      <>
                        <span key={`n-${i}`} className="text-sm text-gray-800">{nombre}</span>
                        <span key={`a4-${i}`} className="text-sm font-semibold text-gray-900 text-center">{vals.a4 ?? "—"}</span>
                        <span key={`a3-${i}`} className="text-sm font-semibold text-gray-900 text-center">{vals.a3 ?? "—"}</span>
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
