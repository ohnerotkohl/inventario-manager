"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import type { Caja, Serie, Poster, Inventario } from "@/lib/types";

const SERIES_ORDER = [
  "Life is Food - Kitchen", "Animals", "Fun", "Frases",
  "Bauhaus", "Berlin Prints", "Berlin Botanica", "Cocina",
];

const POSTERS_ORDER: { [serie: string]: string[] } = {
  "Life is Food - Kitchen": ["Garlic", "Onion", "Gurke", "Egg plant", "Limes", "Oranges", "Paprika fever", "Capuccino fever", "Kaffee beans", "Croissants", "Mushrooms", "Sushi"],
  "Animals": ["Octopus", "The Boss Cat (Red)", "The Boss Cat (Yellow)", "My dog is super chill", "Gato trippy", "Miau"],
  "Fun": ["Best Seat Vintage", "Microdose", "Mit Karte Bitte", "Fick Dich", "Harry Pommes", "U make me feel high pink", "U make me feel high blue", "Ready for your shit", "Expresso yourself", "Keep your spirit high", "Clean is Good", "Stay Chili"],
  "Frases": ["Genau", "Berlin", "Schön", "Danke", "Bitte", "Alles Klar", "Genau Vortice", "Genau dit lauf shon"],
  "Bauhaus": ["01 Orange chair", "02 Blue sky chair", "03 Blue sky building", "04 Blue building", "05 Orange house", "06 Yellow house", "07 Blue Orange House", "08 Black chair", "09 Bowie BH"],
  "Berlin Prints": ["Berlin Döner", "Mauerpark Flower", "Wie Geht's? - Mauerpark", "Berlin Mauerpark - vintage girl", "Neukölln graffiti", "Brandenburger Tor", "Kreuzberg 36", "I love Berlin", "Ick bin Bearliner", "Berlin Disco Ball"],
  "Berlin Botanica": ["Mitte", "Kreuzberg", "Neukölln", "Schöneberg", "Prenzlauer Berg", "Wedding", "Friedriechshain", "Lichtenberg", "Charlottenburg", "Moabit", "Pankow", "Spandau"],
  "Cocina": ["Siracha", "Negroni", "Prost", "All we need is Ramen"],
};

interface PosterConStock extends Poster {
  series?: Serie;
  a4Stock: number;
  a3Stock: number;
  a4InvId?: string;
  a3InvId?: string;
  a4SampleFalta?: boolean;
  a3SampleFalta?: boolean;
}

type Step = "seleccion" | "restock" | "confirmado";
type TabPrincipal = "restock" | "historial";

interface RestockHistorial {
  id: string;
  fecha: string;
  cajaId: string;
  caja: string;
  trabajador: string;
  totalA4: number;
  totalA3: number;
  total: number;
  lineas: { nombre: string; posterId: string; talla: string; cantidad: number }[];
}

export default function RestockPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, tr } = useLang();
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("restock");
  const [step, setStep] = useState<Step>("seleccion");
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConStock[]>([]);
  const [cantidades, setCantidades] = useState<{ [key: string]: number }>({});
  // Stock del almacén central de prints, por `poster_id-talla`
  const [almacenPrints, setAlmacenPrints] = useState<{ [key: string]: number }>({});
  const [trabajador, setTrabajador] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<RestockHistorial[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);
  const [eliminandoRestock, setEliminandoRestock] = useState<string | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tabRestock, setTabRestock] = useState<"imprimir" | "restock">("imprimir");
  const [top8, setTop8] = useState<Set<string>>(new Set());
  const [hasSales, setHasSales] = useState<Set<string>>(new Set());
  const [printQty, setPrintQty] = useState<{ [key: string]: number }>({});
  const [printLoading, setPrintLoading] = useState(false);
  // Lista fija de samples que faltaban al abrir la caja; se marca cada uno
  // como hecho sin que desaparezca, para poder tacharlos como checklist
  const [samplesList, setSamplesList] = useState<{ posterId: string; nombre: string; talla: "A4" | "A3" }[]>([]);
  const [saveError, setSaveError] = useState("");
  const [mercadoMins, setMercadoMins] = useState({ minBajo: 3, minMedio: 4, minTop: 8, topN: 5, nombre: "" });

  // El nombre del trabajador viene del usuario logueado
  useEffect(() => {
    if (user?.nombre) setTrabajador((prev) => prev || user.nombre);
  }, [user]);

  function toggleSerie(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function computePrintQty(
    topSet: Set<string>,
    hs: Set<string>,
    ps: PosterConStock[],
    mins: { minBajo: number; minMedio: number; minTop: number }
  ) {
    const qty: { [key: string]: number } = {};
    ps.forEach((p) => {
      const target = topSet.has(p.id) ? mins.minTop : hs.has(p.id) ? mins.minMedio : mins.minBajo;
      if (p.tiene_a4) {
        const stock = p.a4Stock;
        if (stock < target) qty[`${p.id}-A4`] = Math.max(1, target - stock);
      }
      if (p.tiene_a3) {
        const stock = p.a3Stock;
        if (stock < target) qty[`${p.id}-A3`] = Math.max(1, target - stock);
      }
    });
    return qty;
  }

  async function loadPrintData(ps: PosterConStock[], cid: string) {
    setPrintLoading(true);

    // 1. Mercados asociados a esta caja → obtener sus mínimos configurados
    type MercRow = { id: string; nombre: string; min_bajo: number; min_medio: number; min_top: number; top_n: number };
    const { data: mercadosData } = await supabase
      .from("mercados")
      .select("id, nombre, min_bajo, min_medio, min_top, top_n")
      .eq("caja_id", cid);
    const mercs = (mercadosData || []) as unknown as MercRow[];

    // Usar el máximo de cada umbral (preparar para el mercado más exigente)
    const minTop  = mercs.length > 0 ? Math.max(...mercs.map(m => m.min_top  ?? 8)) : 8;
    const minMedio = mercs.length > 0 ? Math.max(...mercs.map(m => m.min_medio ?? 4)) : 4;
    const minBajo  = mercs.length > 0 ? Math.max(...mercs.map(m => m.min_bajo  ?? 3)) : 3;
    const topN     = mercs.length > 0 ? Math.max(...mercs.map(m => m.top_n     ?? 5)) : 5;
    const nombre   = mercs.map(m => m.nombre).join(" + ");
    const mins = { minTop, minMedio, minBajo, topN, nombre };
    setMercadoMins(mins);

    // 2. Sesiones en estos mercados
    const mercadoIds = mercs.map(m => m.id);
    let newTop = new Set<string>();
    let newHasSales = new Set<string>();

    if (mercadoIds.length > 0) {
      const { data: sesionesData } = await supabase
        .from("sesiones")
        .select("id")
        .in("mercado_id", mercadoIds);
      const sesionIds = ((sesionesData || []) as { id: string }[]).map(s => s.id);

      if (sesionIds.length > 0) {
        // 3. Ventas históricas en estas sesiones → velocidad por póster
        const { data: ventasData } = await supabase
          .from("ventas")
          .select("poster_id, cantidad")
          .in("sesion_id", sesionIds);
        const totales: { [id: string]: number } = {};
        ((ventasData || []) as { poster_id: string; cantidad: number }[])
          .forEach(v => { totales[v.poster_id] = (totales[v.poster_id] || 0) + v.cantidad; });
        const sorted = Object.entries(totales).sort((a, b) => b[1] - a[1]);
        newTop = new Set(sorted.slice(0, topN).map(([id]) => id));
        newHasSales = new Set(sorted.map(([id]) => id));
      }
    }

    setTop8(newTop);
    setHasSales(newHasSales);
    setPrintQty(computePrintQty(newTop, newHasSales, ps, mins));
    setPrintLoading(false);
  }

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    supabase.from("cajas").select("*").then(({ data }) => {
      setCajas(data || []);
    });
  }, [user]);

  useEffect(() => {
    if (tabPrincipal === "historial") fetchHistorial();
  }, [tabPrincipal]);

  // Guard: warn before navigating away with unsaved restock entries
  useEffect(() => {
    const isDirty = step === "restock" && Object.values(cantidades).some(v => v > 0);
    if (!isDirty) return;

    const msg = t.leaveConfirm;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = msg;
    };

    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
      if (window.confirm(msg)) originalPushState(...args);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.history.pushState = originalPushState;
    };
  }, [step, cantidades, t.leaveConfirm]);

  async function fetchHistorial() {
    setLoadingHistorial(true);
    const { data } = await supabase
      .from("restocks")
      .select("id, fecha, caja_id, trabajador, cajas(nombre), restock_lineas(poster_id, cantidad, talla, posters(nombre))")
      .order("fecha", { ascending: false });

    type RestockRow = {
      id: string;
      fecha: string;
      caja_id: string;
      trabajador: string;
      cajas: { nombre: string } | null;
      restock_lineas: { poster_id: string; cantidad: number; talla: string; posters: { nombre: string } | null }[];
    };

    const rows = (data || []) as unknown as RestockRow[];
    setHistorial(rows.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      cajaId: r.caja_id,
      caja: r.cajas?.nombre || "—",
      trabajador: r.trabajador || "—",
      totalA4: r.restock_lineas.filter((l) => l.talla === "A4").reduce((a, l) => a + l.cantidad, 0),
      totalA3: r.restock_lineas.filter((l) => l.talla === "A3").reduce((a, l) => a + l.cantidad, 0),
      total: r.restock_lineas.reduce((a, l) => a + l.cantidad, 0),
      lineas: r.restock_lineas.map((l) => ({ nombre: l.posters?.nombre || "—", posterId: l.poster_id, talla: l.talla, cantidad: l.cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
    })));
    setLoadingHistorial(false);
  }

  // Eliminar un restock: revierte el stock de la caja (resta) y devuelve las
  // unidades al almacén de prints (suma), antes de borrar el registro
  async function eliminarRestock(r: RestockHistorial) {
    if (!confirm(t.deleteRestockConfirm)) return;
    setEliminandoRestock(r.id);
    try {
      const [invRes, printsRes] = await Promise.all([
        supabase.from("inventario").select("id, poster_id, talla, cantidad").eq("caja_id", r.cajaId),
        supabase.from("prints_estudio").select("id, poster_id, talla, cantidad"),
      ]);
      const invMap: { [k: string]: { id: string; cantidad: number } } = {};
      for (const i of (invRes.data || []) as { id: string; poster_id: string; talla: string; cantidad: number }[]) {
        invMap[`${i.poster_id}-${i.talla}`] = { id: i.id, cantidad: i.cantidad };
      }
      const printMap: { [k: string]: { id: string; cantidad: number } } = {};
      for (const p of (printsRes.data || []) as { id: string; poster_id: string; talla: string; cantidad: number }[]) {
        printMap[`${p.poster_id}-${p.talla}`] = { id: p.id, cantidad: p.cantidad };
      }
      const ops: PromiseLike<unknown>[] = [];
      for (const l of r.lineas) {
        const inv = invMap[`${l.posterId}-${l.talla}`];
        if (inv) {
          const nuevo = Math.max(0, inv.cantidad - l.cantidad);
          ops.push(supabase.from("inventario").update({ cantidad: nuevo, out: nuevo === 0 }).eq("id", inv.id));
        }
        const pr = printMap[`${l.posterId}-${l.talla}`];
        if (pr) {
          ops.push(supabase.from("prints_estudio").update({ cantidad: pr.cantidad + l.cantidad, updated_at: new Date().toISOString() }).eq("id", pr.id));
        } else {
          ops.push(supabase.from("prints_estudio").insert({ poster_id: l.posterId, talla: l.talla, cantidad: l.cantidad }));
        }
      }
      await Promise.all(ops);
      await supabase.from("restock_lineas").delete().eq("restock_id", r.id);
      await supabase.from("restocks").delete().eq("id", r.id);
    } catch (e) {
      console.error("Error eliminando restock:", e);
    }
    setEliminandoRestock(null);
    fetchHistorial();
  }

  async function cargarPosters() {
    if (!cajaId) return;
    setLoading(true);

    const [postersRes, invRes, seriesRes, printsRes] = await Promise.all([
      supabase.from("posters").select("*, series(*)").eq("activo", true),
      supabase.from("inventario").select("*").eq("caja_id", cajaId),
      supabase.from("series").select("*"),
      supabase.from("prints_estudio").select("poster_id, talla, cantidad"),
    ]);

    const inv: Inventario[] = invRes.data || [];
    setSeries(seriesRes.data || []);

    // Stock del almacén central de prints (para verlo al reponer)
    const printMap: { [key: string]: number } = {};
    for (const p of (printsRes.data || []) as { poster_id: string; talla: string; cantidad: number }[]) {
      printMap[`${p.poster_id}-${p.talla}`] = p.cantidad;
    }
    setAlmacenPrints(printMap);

    const postersConStock: PosterConStock[] = (postersRes.data || []).map((p: Poster & { series?: Serie }) => {
      const a4 = inv.find((i) => i.poster_id === p.id && i.talla === "A4");
      const a3 = inv.find((i) => i.poster_id === p.id && i.talla === "A3");
      return {
        ...p,
        a4Stock: a4?.cantidad || 0,
        a3Stock: a3?.cantidad || 0,
        a4InvId: a4?.id,
        a3InvId: a3?.id,
        a4SampleFalta: a4?.sample_falta || false,
        a3SampleFalta: a3?.sample_falta || false,
      };
    });

    setPosters(postersConStock);

    // Congelar la lista de samples que faltan al entrar (por póster + talla)
    const sList: { posterId: string; nombre: string; talla: "A4" | "A3" }[] = [];
    for (const p of postersConStock) {
      if (p.tiene_a4 && p.a4SampleFalta) sList.push({ posterId: p.id, nombre: p.nombre, talla: "A4" });
      if (p.tiene_a3 && p.a3SampleFalta) sList.push({ posterId: p.id, nombre: p.nombre, talla: "A3" });
    }
    sList.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.talla.localeCompare(b.talla));
    setSamplesList(sList);

    setCantidades({});
    setPrintQty({});
    setTop8(new Set());
    setHasSales(new Set());
    setTabRestock("imprimir");
    setLoading(false);
    setStep("restock");
    loadPrintData(postersConStock, cajaId);
  }

  // Marcar/desmarcar un sample como hecho. sample_falta=false significa "hecho".
  // Se guarda al momento en el inventario de esta caja.
  async function toggleSample(posterId: string, talla: "A4" | "A3") {
    const poster = posters.find((p) => p.id === posterId);
    if (!poster) return;
    const falta = talla === "A4" ? poster.a4SampleFalta : poster.a3SampleFalta;
    const nuevaFalta = !falta; // si faltaba -> hecho; si estaba hecho -> vuelve a faltar
    const campo = talla === "A4" ? "a4SampleFalta" : "a3SampleFalta";
    setPosters((prev) => prev.map((p) => (p.id === posterId ? { ...p, [campo]: nuevaFalta } : p)));
    const invId = talla === "A4" ? poster.a4InvId : poster.a3InvId;
    if (invId) {
      const { error } = await supabase.from("inventario").update({ sample_falta: nuevaFalta }).eq("id", invId);
      if (error) {
        // Revertir en pantalla si no se pudo guardar
        setPosters((prev) => prev.map((p) => (p.id === posterId ? { ...p, [campo]: falta } : p)));
      }
    }
  }

  async function confirmarRestock() {
    setGuardando(true);
    setSaveError("");

    // Use local date (not UTC) — avoids wrong date at 23h in Berlin
    const now = new Date();
    const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    try {
      // Get or create the restock record for today + this box
      let restockId: string;
      const { data: restockExistente, error: findErr } = await supabase
        .from("restocks")
        .select("id")
        .eq("caja_id", cajaId)
        .eq("fecha", hoy)
        .maybeSingle();

      if (findErr) throw new Error(`Error buscando restock: ${findErr.message}`);

      if (restockExistente) {
        restockId = restockExistente.id;
      } else {
        const { data: nuevoRestock, error: insertErr } = await supabase
          .from("restocks")
          .insert({ caja_id: cajaId, fecha: hoy, trabajador: trabajador.trim() })
          .select()
          .single();
        if (insertErr || !nuevoRestock) throw new Error(`Error creando restock: ${insertErr?.message || "sin datos"}`);
        restockId = nuevoRestock.id;
      }

      // Update inventory one by one — check each for errors
      const lineas: { restock_id: string; poster_id: string; talla: string; cantidad: number }[] = [];

      for (const [key, cantidad] of Object.entries(cantidades)) {
        if (cantidad <= 0) continue;
        const talla = key.slice(-2) as "A4" | "A3";
        const posterId = key.slice(0, -3);
        const poster = posters.find((p) => p.id === posterId);
        if (!poster) continue;

        lineas.push({ restock_id: restockId, poster_id: posterId, talla, cantidad });

        const invId = talla === "A4" ? poster.a4InvId : poster.a3InvId;
        const stockActual = talla === "A4" ? poster.a4Stock : poster.a3Stock;
        const nuevoStock = stockActual + cantidad;

        let invErr;
        if (invId) {
          const res = await supabase.from("inventario").update({ cantidad: nuevoStock, out: false }).eq("id", invId);
          invErr = res.error;
        } else {
          const res = await supabase.from("inventario").upsert(
            { caja_id: cajaId, poster_id: posterId, talla, cantidad: nuevoStock, out: false },
            { onConflict: "caja_id,poster_id,talla" }
          );
          invErr = res.error;
        }
        if (invErr) throw new Error(`Error actualizando inventario (${poster.nombre} ${talla}): ${invErr.message}`);
      }

      // Insert restock lines
      if (lineas.length > 0) {
        const { error: lineasErr } = await supabase.from("restock_lineas").insert(lineas);
        if (lineasErr) throw new Error(`Error guardando líneas: ${lineasErr.message}`);
      }

      // B2: descontar del almacén central de prints lo que se acaba de reponer.
      // Va aparte y no rompe el restock si falla: reponer la caja es lo crítico.
      try {
        const { data: printsActuales } = await supabase
          .from("prints_estudio")
          .select("id, poster_id, talla, cantidad");
        const printMap: { [k: string]: { id: string; cantidad: number } } = {};
        for (const p of (printsActuales || []) as { id: string; poster_id: string; talla: string; cantidad: number }[]) {
          printMap[`${p.poster_id}-${p.talla}`] = { id: p.id, cantidad: p.cantidad };
        }
        const descuentos = [];
        for (const l of lineas) {
          const existente = printMap[`${l.poster_id}-${l.talla}`];
          if (existente) {
            const nueva = Math.max(0, existente.cantidad - l.cantidad);
            descuentos.push(
              supabase.from("prints_estudio").update({ cantidad: nueva, updated_at: new Date().toISOString() }).eq("id", existente.id)
            );
          }
        }
        if (descuentos.length > 0) await Promise.all(descuentos);
      } catch (e) {
        console.error("No se pudo descontar del almacén de prints:", e);
      }

      setGuardando(false);
      setStep("confirmado");

    } catch (err) {
      console.error("Restock error:", err);
      setSaveError(err instanceof Error ? err.message : "Error desconocido. Intenta de nuevo.");
      setGuardando(false);
    }
  }

  const totalUnidades = Object.values(cantidades).reduce((a, b) => a + b, 0);
  const totalPosters = Object.values(cantidades).filter((v) => v > 0).length;
  const totalA4 = Object.entries(cantidades).filter(([k, v]) => v > 0 && k.endsWith("-A4")).reduce((a, [, v]) => a + v, 0);
  const totalA3 = Object.entries(cantidades).filter(([k, v]) => v > 0 && k.endsWith("-A3")).reduce((a, [, v]) => a + v, 0);
  const caja = cajas.find((c) => c.id === cajaId);

  const seriesIds = [...new Set(posters.map((p) => p.serie_id))].sort((a, b) => {
    const sa = series.find((s) => s.id === a);
    const sb = series.find((s) => s.id === b);
    const ia = SERIES_ORDER.indexOf(sa?.nombre || "");
    const ib = SERIES_ORDER.indexOf(sb?.nombre || "");
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (step === "confirmado") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-green-600">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{t.restockDone}</h2>
        <p className="text-gray-500">
          Se añadieron <strong>{totalUnidades} unidades</strong> ({totalA4 > 0 ? `A4: ${totalA4}` : ""}{totalA4 > 0 && totalA3 > 0 ? " · " : ""}{totalA3 > 0 ? `A3: ${totalA3}` : ""}) al stock de <strong>{caja?.nombre}</strong>.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => { setStep("seleccion"); setCantidades({}); setCajaId(""); }}
            className="bg-black text-white px-6 py-3 rounded-2xl font-semibold hover:bg-gray-900"
          >
            {t.anotherRestock}
          </button>
          <button
            onClick={() => { setStep("seleccion"); setCantidades({}); setCajaId(""); setTabPrincipal("historial"); }}
            className="border-2 border-black text-black px-6 py-3 rounded-2xl font-semibold hover:bg-gray-50"
          >
            {t.viewHistory}
          </button>
        </div>
      </div>
    );
  }

  if (step === "seleccion") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.restockTitle}</h1>
          <p className="text-gray-500 text-sm">{t.restockSubtitle}</p>
        </div>

        {/* Tabs principales */}
        <div className="flex gap-2">
          <button
            onClick={() => setTabPrincipal("restock")}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tabPrincipal === "restock" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            {t.newRestock}
          </button>
          <button
            onClick={() => setTabPrincipal("historial")}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tabPrincipal === "historial" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {t.history}
          </button>
        </div>

        {tabPrincipal === "historial" && (
          <div className="space-y-3">
            {loadingHistorial ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />)}
              </div>
            ) : historial.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="flex justify-center mb-2">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                </div>
                <p>{t.noHistory}</p>
              </div>
            ) : (() => {
              const [cy, cm] = calendarMonth.split("-").map(Number);
              const firstDow = new Date(cy, cm - 1, 1).getDay();
              const startOffset = firstDow === 0 ? 6 : firstDow - 1;
              const daysInMonth = new Date(cy, cm, 0).getDate();
              const restockDates = new Set(historial.map(r => r.fecha));

              const prevMonth = () => {
                if (cm === 1) setCalendarMonth(`${cy - 1}-12`);
                else setCalendarMonth(`${cy}-${String(cm - 1).padStart(2, "0")}`);
                setSelectedDate(null);
              };
              const nextMonth = () => {
                if (cm === 12) setCalendarMonth(`${cy + 1}-01`);
                else setCalendarMonth(`${cy}-${String(cm + 1).padStart(2, "0")}`);
                setSelectedDate(null);
              };

              const filtered = selectedDate
                ? historial.filter(r => r.fecha === selectedDate)
                : historial;

              const porMes = filtered.reduce((acc, r) => {
                const key = r.fecha.slice(0, 7);
                (acc[key] = acc[key] || []).push(r);
                return acc;
              }, {} as { [k: string]: typeof historial });
              const meses = Object.keys(porMes).sort((a, b) => b.localeCompare(a));

              return (<>
                {/* Calendario */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg">‹</button>
                    <span className="font-semibold text-sm text-gray-900">
                      {new Date(calendarMonth + "-01T12:00:00").toLocaleDateString("es-DE", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}
                    </span>
                    <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg">›</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {t.calDays.map((d: string) => (
                      <span key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1">
                    {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${calendarMonth}-${String(day).padStart(2, "0")}`;
                      const hasRestock = restockDates.has(dateStr);
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button
                          key={day}
                          onClick={() => hasRestock && setSelectedDate(isSelected ? null : dateStr)}
                          className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                            ${isSelected ? "bg-black text-white font-bold" :
                              hasRestock ? "bg-gray-900 text-white font-semibold hover:bg-gray-700" :
                              "text-gray-400 cursor-default"}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDate && (
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-700 underline">Ver todo</button>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No hay restocks este día</div>
                ) : meses.map((mes) => (
                <div key={mes} className="space-y-2">
                  {!selectedDate && <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">
                    {new Date(mes + "-01T12:00:00").toLocaleDateString("es-DE", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}
                  </p>}
                  {porMes[mes].map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setHistorialAbierto(historialAbierto === r.id ? null : r.id)}
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{r.caja}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(r.fecha + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long" })} · {r.trabajador}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{r.total} uds.</p>
                      <p className="text-xs text-gray-400">{r.totalA4 > 0 ? `A4: ${r.totalA4}` : ""}{r.totalA4 > 0 && r.totalA3 > 0 ? " · " : ""}{r.totalA3 > 0 ? `A3: ${r.totalA3}` : ""}</p>
                    </div>
                    <span className="text-gray-400">{historialAbierto === r.id ? "▲" : "▼"}</span>
                  </div>
                </button>
                {historialAbierto === r.id && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="grid grid-cols-[1fr_40px_40px] gap-x-3 gap-y-1.5">
                      <span className="text-xs font-semibold text-gray-400">{t.poster}</span>
                      <span className="text-xs font-semibold text-gray-400 text-center">A4</span>
                      <span className="text-xs font-semibold text-gray-400 text-center">A3</span>
                      {Object.entries(
                        r.lineas.reduce((acc, l) => {
                          acc[l.nombre] = acc[l.nombre] || {};
                          if (l.talla === "A4") acc[l.nombre].a4 = (acc[l.nombre].a4 || 0) + l.cantidad;
                          if (l.talla === "A3") acc[l.nombre].a3 = (acc[l.nombre].a3 || 0) + l.cantidad;
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
                    <button
                      onClick={() => eliminarRestock(r)}
                      disabled={eliminandoRestock === r.id}
                      className="mt-4 w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                      </svg>
                      {eliminandoRestock === r.id ? t.saving : t.deleteRestock}
                    </button>
                  </div>
                )}
              </div>
            ))}
                </div>
              ))}
              </>);
            })()}
          </div>
        )}

        {tabPrincipal === "restock" && <>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t.restockManager}</label>
            <input
              type="text"
              value={trabajador}
              onChange={(e) => setTrabajador(e.target.value)}
              placeholder="Nombre"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-gray-700">{t.whichBox}</p>
          {cajas.map((c) => (
            <button
              key={c.id}
              onClick={() => setCajaId(c.id)}
              className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-colors ${
                cajaId === c.id ? "border-black bg-black text-white" : "border-gray-300 hover:border-gray-500"
              }`}
            >
              <p className={`font-bold ${cajaId === c.id ? "text-white" : "text-gray-900"}`}>{c.nombre}</p>
              <p className={`text-xs mt-0.5 ${cajaId === c.id ? "text-gray-300" : "text-gray-600"}`}>{c.descripcion}</p>
            </button>
          ))}
        </div>

        <button
          onClick={cargarPosters}
          disabled={!cajaId || !trabajador.trim() || loading}
          className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg disabled:opacity-40 hover:bg-gray-900 transition-colors"
        >
          {loading ? t.loading : t.continueBtn}
        </button>
        </>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restock — {caja?.nombre}</h1>
      </div>

      {/* Tab switcher Imprimir / Restock */}
      <div className="flex gap-2">
        <button
          onClick={() => setTabRestock("imprimir")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-1.5 ${tabRestock === "imprimir" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
          </svg>
          {t.printTab}
        </button>
        <button
          onClick={() => setTabRestock("restock")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tabRestock === "restock" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          {t.restock}
        </button>
      </div>

      {/* Tab Imprimir */}
      {tabRestock === "imprimir" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{t.printTabDesc}</p>
            <button
              onClick={() => setPrintQty({})}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
            >
              Limpiar todo
            </button>
          </div>
          {/* Info de mínimos del mercado */}
          {mercadoMins.nombre && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs text-gray-500 font-medium">{mercadoMins.nombre}</span>
              <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">⭐ top {mercadoMins.topN} → mín. {mercadoMins.minTop}</span>
              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">↗ con ventas → mín. {mercadoMins.minMedio}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">— sin ventas → mín. {mercadoMins.minBajo}</span>
            </div>
          )}
          {printLoading ? (
            <div className="text-sm text-gray-400 text-center py-8">{t.loadingBestsellers}</div>
          ) : (() => {
            // `printQty` es lo que falta para el mínimo: eso se repone en la caja.
            // Pero lo que hay que mandar a imprimir es solo lo que el backup del
            // estudio no cubre — lo demás ya está impreso.
            const aImprimir = (key: string) => Math.max(0, (printQty[key] ?? 0) - (almacenPrints[key] ?? 0));
            const a4Items = posters.filter((p) => p.tiene_a4 && (printQty[`${p.id}-A4`] ?? 0) > 0);
            const a3Items = posters.filter((p) => p.tiene_a3 && (printQty[`${p.id}-A3`] ?? 0) > 0);
            const a4Print = a4Items.filter((p) => aImprimir(`${p.id}-A4`) > 0);
            const a3Print = a3Items.filter((p) => aImprimir(`${p.id}-A3`) > 0);
            if (a4Items.length === 0 && a3Items.length === 0) {
              return (
                <div className="text-center py-12 text-gray-400">
                  <svg className="mx-auto mb-3 text-green-400" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <p className="font-medium text-gray-500">{t.nothingToPrint}</p>
                </div>
              );
            }
            const PrintSection = ({ items, talla, label }: { items: PosterConStock[]; talla: "A4" | "A3"; label: string }) => (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  {items.map((p, idx) => {
                    const key = `${p.id}-${talla}`;
                    const qty = printQty[key] ?? 0;
                    const stock = talla === "A4" ? p.a4Stock : p.a3Stock;
                    const isTop8 = top8.has(p.id);
                    const isMed = !isTop8 && hasSales.has(p.id);
                    const backup = almacenPrints[key] ?? 0;
                    const imprimir = aImprimir(key);
                    // El backup cubre lo que falta: esta fila no se imprime, se
                    // repone del estudio. Se atenúa para no mandarla a imprenta.
                    const cubierto = backup > 0 && imprimir === 0;
                    return (
                      <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${cubierto ? "bg-yellow-50" : ""} ${idx < items.length - 1 ? "border-b border-gray-100" : ""}`}>
                        <div className="flex-1 min-w-0">
                          {isTop8 && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md">{t.bestseller}</span>}
                          {isMed && <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded-md">↗ {t.medSeller}</span>}
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                            {backup > 0 && (
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-yellow-100 text-yellow-800 whitespace-nowrap">
                                {tr("backupLeft", { n: backup })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{tr("currentStock", { n: stock })}</p>
                          {backup > 0 && imprimir > 0 && (
                            <p className="text-xs font-semibold text-yellow-700">{tr("restockPrintSplit", { r: qty, i: imprimir })}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPrintQty((prev) => ({ ...prev, [key]: Math.max(1, qty - 1) }))} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200">−</button>
                          <span className={`w-6 text-center font-bold ${cubierto ? "text-gray-300 line-through" : "text-gray-900"}`}>{qty}</span>
                          <button onClick={() => setPrintQty((prev) => ({ ...prev, [key]: qty + 1 }))} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200">+</button>
                          <button onClick={() => setPrintQty((prev) => ({ ...prev, [key]: 0 }))} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-300 hover:bg-red-50 hover:text-red-400 font-bold flex items-center justify-center transition-colors text-base">×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
            // Al PDF solo va lo que el backup no cubre
            function openPrint(talla: "A4" | "A3") {
              const items = posters
                .filter((p) => aImprimir(`${p.id}-${talla}`) > 0 && (talla === "A4" ? p.tiene_a4 : p.tiene_a3))
                .map((p) => ({ nombre: p.nombre, talla, qty: aImprimir(`${p.id}-${talla}`) }));
              localStorage.setItem("or_print_job", JSON.stringify(items));
              window.open("/imprimir", "_blank");
            }
            return (
              <>
                {a4Items.length > 0 && <PrintSection items={a4Items} talla="A4" label={`A4 — ${a4Items.length} diseños`} />}
                {a3Items.length > 0 && <PrintSection items={a3Items} talla="A3" label={`A3 — ${a3Items.length} diseños`} />}
                {a4Print.length === 0 && a3Print.length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-yellow-800">{t.nothingToPrintBackup}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  {a4Print.length > 0 && (
                    <button
                      onClick={() => openPrint("A4")}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      A4
                    </button>
                  )}
                  {a3Print.length > 0 && (
                    <button
                      onClick={() => openPrint("A3")}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      A3
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setCantidades({ ...printQty });
                    setTabRestock("restock");
                  }}
                  className="w-full py-3 bg-black text-white rounded-2xl font-semibold hover:bg-gray-900 transition-colors"
                >
                  {t.continueBtn}
                </button>
              </>
            );
          })()}

          {/* Samples — checklist al final: marca cada uno cuando lo hayas hecho */}
          {samplesList.length > 0 && (() => {
            const pendientes = samplesList.filter((s) => {
              const p = posters.find((pp) => pp.id === s.posterId);
              return s.talla === "A4" ? p?.a4SampleFalta : p?.a3SampleFalta;
            }).length;
            return (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-orange-600">{t.samplesTitle}</p>
                  <span className="text-xs bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded-full">{pendientes}</span>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-2xl overflow-hidden">
                  {samplesList.map((s, idx) => {
                    const p = posters.find((pp) => pp.id === s.posterId);
                    const falta = s.talla === "A4" ? p?.a4SampleFalta : p?.a3SampleFalta;
                    const hecho = !falta;
                    return (
                      <button
                        key={`${s.posterId}-${s.talla}`}
                        onClick={() => toggleSample(s.posterId, s.talla)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${idx < samplesList.length - 1 ? "border-b border-orange-100" : ""} ${hecho ? "bg-orange-50/40" : "hover:bg-orange-100/50"}`}
                      >
                        <span className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${hecho ? "bg-green-500 border-green-500 text-white" : "border-orange-300 bg-white"}`}>
                          {hecho && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                        <span className={`flex-1 text-sm font-medium ${hecho ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.nombre}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${s.talla === "A4" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{s.talla}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab Restock */}
      {tabRestock === "restock" && <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{t.writeUnitsToAdd}</p>
          <div className="flex items-center gap-3">
            {(() => {
              const allCollapsed = seriesIds.length > 0 && seriesIds.every(id => collapsed.has(id));
              return (
                <button
                  onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(seriesIds))}
                  className="text-xs text-gray-400 hover:text-gray-700 underline transition-colors"
                >
                  {allCollapsed ? t.expandAll : t.collapseAll}
                </button>
              );
            })()}
            <button
              onClick={() => setCantidades({})}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
            >
              Limpiar todo
            </button>
          </div>
        </div>
        {seriesIds.map((sid) => {
          const serie = series.find((s) => s.id === sid);
          const isCollapsed = collapsed.has(sid);
          const orden = POSTERS_ORDER[serie?.nombre || ""] || [];
          const sp = posters
            .filter((p) => p.serie_id === sid)
            .sort((a, b) => {
              const ia = orden.indexOf(a.nombre);
              const ib = orden.indexOf(b.nombre);
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });

          return (
            <div key={sid}>
              <button
                onClick={() => toggleSerie(sid)}
                className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: (serie?.color || "#6B7280") + "22", color: serie?.color || "#6B7280" }}
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {serie?.nombre}
              </button>
              {!isCollapsed && <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_90px_90px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <span>{t.poster}</span>
                  <span className="text-center">A4</span>
                  <span className="text-center">A3</span>
                </div>
                {sp.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_90px_90px] gap-2 px-4 py-3 items-center ${idx < sp.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <span className="text-sm text-gray-800">{p.nombre}</span>
                    {p.tiene_a4 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          placeholder="0"
                          value={cantidades[`${p.id}-A4`] || ""}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [`${p.id}-A4`]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          onBlur={(e) => setCantidades((prev) => ({ ...prev, [`${p.id}-A4`]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          onFocus={(e) => e.target.select()}
                          className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-black"
                        />
                        <span className="text-xs text-gray-400">{tr("currentStock", { n: p.a4Stock })}</span>
                        {(almacenPrints[`${p.id}-A4`] ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold text-yellow-700">{tr("warehouseStock", { n: almacenPrints[`${p.id}-A4`] })}</span>
                        )}
                      </div>
                    ) : <div />}
                    {p.tiene_a3 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          placeholder="0"
                          value={cantidades[`${p.id}-A3`] || ""}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [`${p.id}-A3`]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          onBlur={(e) => setCantidades((prev) => ({ ...prev, [`${p.id}-A3`]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          onFocus={(e) => e.target.select()}
                          className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-black"
                        />
                        <span className="text-xs text-gray-400">{tr("currentStock", { n: p.a3Stock })}</span>
                        {(almacenPrints[`${p.id}-A3`] ?? 0) > 0 && (
                          <span className="text-[10px] font-semibold text-yellow-700">{tr("warehouseStock", { n: almacenPrints[`${p.id}-A3`] })}</span>
                        )}
                      </div>
                    ) : <div />}
                  </div>
                ))}
              </div>}
            </div>
          );
        })}
      </div>}

      {/* Botón guardar (solo en tab restock) */}
      {tabRestock === "restock" && (
        <div className="sticky bottom-20 space-y-2">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <p className="text-sm text-red-700 font-semibold">⚠ {saveError}</p>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{tr("unitsOf", { total: totalUnidades, designs: totalPosters })}</p>
              <p className="text-xs text-gray-500">{totalA4 > 0 ? `A4: ${totalA4}` : ""}{totalA4 > 0 && totalA3 > 0 ? " · " : ""}{totalA3 > 0 ? `A3: ${totalA3}` : ""} · {caja?.nombre}</p>
            </div>
            <button
              onClick={() => { setSaveError(""); confirmarRestock(); }}
              disabled={guardando || totalUnidades === 0}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors"
            >
              {guardando ? t.saving : t.save}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
