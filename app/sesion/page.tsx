"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Mercado, Poster, Serie, Inventario } from "@/lib/types";
import { SkeletonList } from "@/app/components/Skeleton";
import { Check, CheckCircle, Printer, Pencil, Dot } from "@/app/components/Icons";
import { useLang } from "@/app/components/LangProvider";
import { useAuth } from "@/app/components/AuthProvider";

// Fecha de HOY en horario local (Berlín), no UTC. new Date().toISOString() da la
// fecha UTC, que entre medianoche y las 01:00/02:00 devuelve el día de AYER y
// registraría el cierre de mercado con la fecha equivocada.
function fechaLocalHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SERIES_ORDER = [
  "Life is Food - Kitchen",
  "Animals",
  "Fun",
  "Frases",
  "Bauhaus",
  "Berlin Prints",
  "Berlin Botanica",
  "Cocina",
];

const POSTERS_ORDER: { [serie: string]: string[] } = {
  "Life is Food - Kitchen": [
    "Garlic", "Onion", "Gurke", "Egg plant", "Limes", "Oranges",
    "Paprika fever", "Capuccino fever", "Kaffee beans", "Croissants", "Mushrooms", "Sushi",
  ],
  "Animals": [
    "Octopus", "The Boss Cat (Red)", "The Boss Cat (Yellow)",
    "My dog is super chill", "Gato trippy", "Miau",
  ],
  "Fun": [
    "Best Seat Vintage", "Microdose", "Mit Karte Bitte", "Fick Dich", "Harry Pommes",
    "U make me feel high pink", "U make me feel high blue", "Ready for your shit",
    "Expresso yourself", "Keep your spirit high", "Clean is Good", "Stay Chili",
  ],
  "Frases": [
    "Genau", "Berlin", "Schön", "Danke", "Bitte", "Alles Klar",
    "Genau Vortice", "Genau dit lauf shon",
  ],
  "Bauhaus": [
    "01 Orange chair", "02 Blue sky chair", "03 Blue sky building", "04 Blue building",
    "05 Orange house", "06 Yellow house", "07 Blue Orange House", "08 Black chair", "09 Bowie BH",
  ],
  "Berlin Prints": [
    "Berlin Döner", "Mauerpark Flower", "Wie Geht's? - Mauerpark",
    "Berlin Mauerpark - vintage girl", "Neukölln graffiti", "Brandenburger Tor",
    "Kreuzberg 36", "I love Berlin", "Ick bin Bearliner", "Berlin Disco Ball",
  ],
  "Berlin Botanica": [
    "Mitte", "Kreuzberg", "Neukölln", "Schöneberg", "Prenzlauer Berg",
    "Wedding", "Friedriechshain", "Lichtenberg", "Charlottenburg", "Moabit", "Pankow", "Spandau",
  ],
  "Cocina": [
    "Siracha", "Negroni", "Prost", "All we need is Ramen",
  ],
};

const MATERIALES_KEYS = [
  "matPackingBags", "matBagsA4", "matBagsA3",
  "matThumbtacks", "matTape", "matGums",
  "matCards", "matStickers",
] as const;
type MaterialKey = typeof MATERIALES_KEYS[number];

// Formato de euros para el cuadre (2 decimales, símbolo €)
const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("es-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

type Step = "info" | "ventas" | "confirmado";
type TabPrincipal = "nueva" | "historial";

interface PosterConSeries extends Poster {
  series?: Serie;
}

interface SesionHistorial {
  id: string;
  fecha: string;
  mercadoId: string;
  mercadoNombre: string;
  cajaId: string;
  trabajador: string;
  totalVentas: number;
  lineas: { nombre: string; talla: string; cantidad: number }[];
  materiales: string[];
  combosA4: number;
  combosA3: number;
  // Cuadre del cierre con el dinero del balance (null si faltan precios o balance)
  cuadre: { esperado: number; real: number; diff: number; ok: boolean } | null;
}

interface VentaEntry {
  poster_id: string;
  talla: "A4" | "A3";
  cantidad: number;
}

export default function SesionPage() {
  const { t, tr } = useLang();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("info");
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [mercadoId, setMercadoId] = useState("");
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [trabajador, setTrabajador] = useState("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConSeries[]>([]);
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [ventas, setVentas] = useState<{ [key: string]: number }>({});
  // Marcados durante el cierre, por poster_id
  const [samplesFaltantes, setSamplesFaltantes] = useState<Set<string>>(new Set());
  const [soldOut, setSoldOut] = useState<Set<string>>(new Set());
  // Registro de mercado cancelado (calor, lluvia...)
  const [cancelAbierto, setCancelAbierto] = useState(false);
  const [cMercadoId, setCMercadoId] = useState("");
  const [cFecha, setCFecha] = useState(fechaLocalHoy);
  const [cMotivo, setCMotivo] = useState("");
  const [cGuardando, setCGuardando] = useState(false);
  const [cAviso, setCAviso] = useState("");
  const [cajas, setCajas] = useState<{ id: string; nombre: string }[]>([]);
  const [nuevoMercado, setNuevoMercado] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCajaId, setNuevaCajaId] = useState("");
  const [guardandoMercado, setGuardandoMercado] = useState(false);
  const [guardandoInfo, setGuardandoInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Guard síncrono contra doble-submit: el estado `submitting` no bloquea una
  // segunda llamada disparada antes del re-render (dos taps rápidos → 2 sesiones).
  const submittingRef = useRef(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [sesionId, setSesionId] = useState("");
  const [ventasOriginales, setVentasOriginales] = useState<{ [key: string]: number }>({});
  const [modoEdicion, setModoEdicion] = useState(false);
  const [sesionMercadoIdOriginal, setSesionMercadoIdOriginal] = useState("");
  const [reporteImpresion, setReporteImpresion] = useState<{ a4: { linea: string; stockRestante: number }[]; a3: { linea: string; stockRestante: number }[] }>({ a4: [], a3: [] });
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("nueva");
  const [historial, setHistorial] = useState<SesionHistorial[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => fechaLocalHoy().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [ideas, setIdeas] = useState("");
  const [materiales, setMateriales] = useState<string[]>([]);
  // Combos vendidos (packs de 3 pósters con descuento), contados a mano al cierre
  const [combosA4, setCombosA4] = useState(0);
  const [combosA3, setCombosA3] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const reviewPosterIdsRef = useRef<Set<string>>(new Set());

  // El nombre del trabajador viene del usuario logueado
  useEffect(() => {
    if (user?.nombre) setTrabajador((prev) => prev || user.nombre);
  }, [user]);

  useEffect(() => {
    supabase.from("mercados").select("*, cajas(*)").then(({ data }) => {
      setMercados(data || []);
      if (data && data.length > 0) setMercadoId(data[0].id);
    });
    supabase.from("cajas").select("id, nombre").then(({ data }) => {
      setCajas(data || []);
    });
  }, []);

  useEffect(() => {
    if (tabPrincipal === "historial") fetchHistorial();
  }, [tabPrincipal]);

  async function fetchHistorial() {
    setLoadingHistorial(true);
    type SesionRow = {
      id: string;
      fecha: string;
      trabajador: string;
      materiales_faltantes: string[] | null;
      combos_a4: number | null;
      combos_a3: number | null;
      mercados: { id: string; nombre: string; caja_id: string; precio_a4: number; precio_a3: number; precio_combo_a4: number; precio_combo_a3: number } | null;
      ventas: { cantidad: number; talla: string; posters: { nombre: string } | null }[];
    };
    const [sesRes, preciosRes, balancesRes] = await Promise.all([
      supabase
        .from("sesiones")
        .select("id, fecha, trabajador, materiales_faltantes, combos_a4, combos_a3, mercados(id, nombre, caja_id, precio_a4, precio_a3, precio_combo_a4, precio_combo_a3), ventas(cantidad, talla, posters(nombre))")
        .order("fecha", { ascending: false })
        .limit(50),
      supabase.from("mercados").select("id, precio_a4, precio_a3, precio_combo_a4, precio_combo_a3"),
      supabase.from("balances").select("mercado_nombre, fecha, total_ventas"),
    ]);
    type PrecioRow = { id: string; precio_a4: number; precio_a3: number; precio_combo_a4: number; precio_combo_a3: number };
    const precios: Record<string, PrecioRow> = {};
    for (const p of ((preciosRes.data || []) as PrecioRow[])) precios[p.id] = p;
    // Dinero real por mercado+fecha (clave: "nombre|fecha")
    const dinero: Record<string, number> = {};
    for (const b of ((balancesRes.data || []) as { mercado_nombre: string; fecha: string; total_ventas: number }[])) {
      dinero[`${b.mercado_nombre}|${b.fecha}`] = (dinero[`${b.mercado_nombre}|${b.fecha}`] || 0) + b.total_ventas;
    }
    const TOLERANCIA = 10; // EUR: diferencias menores se consideran cuadradas

    const rows = (sesRes.data || []) as unknown as SesionRow[];
    setHistorial(rows.map((r) => {
      const mercadoId = r.mercados?.id || "";
      const mercadoNombre = r.mercados?.nombre || "—";
      const a4 = r.ventas.filter((v) => v.talla === "A4").reduce((a, v) => a + v.cantidad, 0);
      const a3 = r.ventas.filter((v) => v.talla === "A3").reduce((a, v) => a + v.cantidad, 0);
      const combosA4 = r.combos_a4 || 0;
      const combosA3 = r.combos_a3 || 0;

      // Cuadre: solo si el mercado tiene precios y existe balance de dinero ese día
      let cuadre: SesionHistorial["cuadre"] = null;
      const pr = precios[mercadoId];
      const real = dinero[`${mercadoNombre}|${r.fecha}`];
      if (pr && (pr.precio_a4 > 0 || pr.precio_a3 > 0) && real !== undefined) {
        // Unidades sueltas = total menos las que van en combos (cada combo = 3 pósters)
        const sueltasA4 = Math.max(0, a4 - 3 * combosA4);
        const sueltasA3 = Math.max(0, a3 - 3 * combosA3);
        const esperado = sueltasA4 * pr.precio_a4 + combosA4 * pr.precio_combo_a4
                       + sueltasA3 * pr.precio_a3 + combosA3 * pr.precio_combo_a3;
        const diff = Math.round((real - esperado) * 100) / 100;
        cuadre = { esperado: Math.round(esperado * 100) / 100, real, diff, ok: Math.abs(diff) <= TOLERANCIA };
      }

      return {
        id: r.id,
        fecha: r.fecha,
        mercadoId,
        mercadoNombre,
        cajaId: r.mercados?.caja_id || "",
        trabajador: r.trabajador || "—",
        totalVentas: r.ventas.reduce((a, v) => a + v.cantidad, 0),
        lineas: r.ventas
          .map((v) => ({ nombre: v.posters?.nombre || "—", talla: v.talla, cantidad: v.cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
        materiales: r.materiales_faltantes || [],
        combosA4,
        combosA3,
        cuadre,
      };
    }));
    setLoadingHistorial(false);
  }

  function editarSesionDesdeHistorial(sesion: SesionHistorial) {
    setMercadoId(sesion.mercadoId);
    setFecha(sesion.fecha);
    setTrabajador(sesion.trabajador);
    setSesionId(sesion.id);
    setSesionMercadoIdOriginal(sesion.mercadoId);
    setModoEdicion(true);
    setTabPrincipal("nueva");
    setStep("info");
  }

  // Guardar solo fecha/trabajador de la sesión, sin tocar las ventas
  async function guardarSoloInfo() {
    if (!sesionId) return;
    if (mercadoId !== sesionMercadoIdOriginal) {
      alert(t.marketChangeNeedsSales);
      return;
    }
    setGuardandoInfo(true);
    const { error } = await supabase
      .from("sesiones")
      .update({ fecha, trabajador: trabajador.trim() })
      .eq("id", sesionId);
    setGuardandoInfo(false);
    if (error) { alert(`${t.saveError}\n${error.message}`); return; }
    setModoEdicion(false);
    setSesionId("");
    setSesionMercadoIdOriginal("");
    setTabPrincipal("historial");
    fetchHistorial();
  }

  function cancelarEdicion() {
    setModoEdicion(false);
    setSesionId("");
    setSesionMercadoIdOriginal("");
    setTabPrincipal("historial");
  }

  async function eliminarSesion(sesion: SesionHistorial) {
    if (!confirm(tr("deleteSessionConfirm", { market: sesion.mercadoNombre, date: new Date(sesion.fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "long" }) }))) return;

    // Revertir inventario: sumar de vuelta las ventas
    const { data: ventasRes } = await supabase.from("ventas").select("poster_id, talla, cantidad").eq("sesion_id", sesion.id);
    const { data: invRes } = await supabase.from("inventario").select("*").eq("caja_id", sesion.cajaId);

    const updates = (ventasRes || []).map((v: { poster_id: string; talla: string; cantidad: number }) => {
      const invItem = (invRes || []).find((i: { poster_id: string; talla: string; id: string; cantidad: number }) => i.poster_id === v.poster_id && i.talla === v.talla);
      if (!invItem) return Promise.resolve();
      return supabase.from("inventario").update({ cantidad: invItem.cantidad + v.cantidad, out: false }).eq("id", invItem.id);
    });

    await Promise.all(updates);
    await supabase.from("sesiones").delete().eq("id", sesion.id);
    await fetchHistorial();
  }

  async function handleCrearMercado() {
    if (!nuevoNombre.trim() || !nuevaCajaId) return;
    setGuardandoMercado(true);
    const { data } = await supabase
      .from("mercados")
      .insert({ nombre: nuevoNombre.trim(), caja_id: nuevaCajaId, dia_semana: "especial" })
      .select("*, cajas(*)")
      .single();
    if (data) {
      setMercados((prev) => [...prev, data]);
      setMercadoId(data.id);
    }
    setNuevoNombre("");
    setNuevaCajaId("");
    setNuevoMercado(false);
    setGuardandoMercado(false);
  }

  async function cargarPosters() {
    if (!mercadoId) return;
    setLoading(true);
    const mercado = mercados.find((m) => m.id === mercadoId);
    if (!mercado) return;

    const [postersRes, invRes, seriesRes] = await Promise.all([
      supabase.from("posters").select("*, series(*)").eq("activo", true).order("nombre"),
      supabase.from("inventario").select("*").eq("caja_id", mercado.caja_id),
      supabase.from("series").select("*"),
    ]);

    setPosters(postersRes.data || []);
    setInventario(invRes.data || []);
    setSeries(seriesRes.data || []);

    // Empiezan vacíos: marcas lo que pasó en este turno (sold out / falta sample)
    setSamplesFaltantes(new Set());
    setSoldOut(new Set());

    if (modoEdicion && sesionId) {
      const [ventasRes, sesionRes] = await Promise.all([
        supabase.from("ventas").select("poster_id, talla, cantidad").eq("sesion_id", sesionId),
        supabase.from("sesiones").select("notas, materiales_faltantes, combos_a4, combos_a3").eq("id", sesionId).single(),
      ]);
      const ventasMap: { [key: string]: number } = {};
      for (const v of (ventasRes.data || [])) {
        const key = `${v.poster_id}-${v.talla}`;
        ventasMap[key] = (ventasMap[key] || 0) + v.cantidad;
      }
      setVentas({ ...ventasMap });
      setVentasOriginales({ ...ventasMap });
      setNotas(sesionRes.data?.notas || "");
      setMateriales(sesionRes.data?.materiales_faltantes || []);
      setCombosA4(sesionRes.data?.combos_a4 || 0);
      setCombosA3(sesionRes.data?.combos_a3 || 0);
    }

    setLoading(false);
  }

  function handleIniciar() {
    if (!mercadoId || !trabajador.trim()) return;
    cargarPosters();
    setStep("ventas");
  }

  // Registrar que un mercado se canceló (calor, lluvia...): contexto para stats
  async function registrarCancelacion() {
    if (!cMercadoId || !cFecha || cGuardando) return;
    setCGuardando(true);
    const nombreM = mercados.find((m) => m.id === cMercadoId)?.nombre || "";
    const { error } = await supabase.from("cancelaciones").insert({
      mercado_id: cMercadoId,
      mercado_nombre: nombreM,
      fecha: cFecha,
      motivo: cMotivo.trim() || null,
      registrado_por: trabajador.trim() || null,
    });
    setCGuardando(false);
    if (error) { alert(t.saveError); return; }
    setCAviso(t.cancellationSaved);
    setTimeout(() => setCAviso(""), 5000);
    setCancelAbierto(false);
    setCMercadoId(""); setCMotivo("");
  }

  function toggleSample(posterId: string) {
    setSamplesFaltantes((prev) => {
      const next = new Set(prev);
      if (next.has(posterId)) next.delete(posterId);
      else next.add(posterId);
      return next;
    });
  }

  function toggleSoldOut(key: string) {
    setSoldOut((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Botones de sold out (rojo) y falta sample (naranja) para una talla concreta
  function FlagsTalla({ posterId, talla }: { posterId: string; talla: "A4" | "A3" }) {
    const key = `${posterId}-${talla}`;
    return (
      <div className="flex gap-1 mt-1">
        <button
          type="button"
          onClick={() => toggleSoldOut(key)}
          title={`${t.soldOutTitle} ${talla}`}
          className={`p-1 rounded-md transition-colors ${soldOut.has(key) ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"}`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => toggleSample(key)}
          title={`${t.missingSampleTitle} ${talla}`}
          className={`p-1 rounded-md transition-colors ${samplesFaltantes.has(key) ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-400"}`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
      </div>
    );
  }

  function openReview() {
    reviewPosterIdsRef.current = new Set(
      Object.entries(ventas)
        .filter(([, c]) => c > 0)
        .map(([key]) => key.slice(0, -3))
    );
    setShowReview(true);
  }

  function setVenta(posterId: string, talla: "A4" | "A3", cantidad: number) {
    setVentas((prev) => ({ ...prev, [`${posterId}-${talla}`]: Math.max(0, cantidad) }));
  }

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    // Solo ideas/materiales/comisiones sin ventas (y sin editar):
    // no crear sesión, solo guardar las notas y enviar el reporte
    const totalVentasSubmit = Object.values(ventas).reduce((a, b) => a + b, 0);
    if (!modoEdicion && totalVentasSubmit === 0) {
      const mercadoNombreSolo = mercados.find((m) => m.id === mercadoId)?.nombre || "";
      const extras: PromiseLike<unknown>[] = [];
      if (notas.trim()) extras.push(supabase.from("comisiones").insert({ texto: notas.trim(), fecha, mercado: mercadoNombreSolo }));
      if (ideas.trim()) extras.push(supabase.from("ideas").insert({ texto: ideas.trim(), fecha, mercado: mercadoNombreSolo }));
      if (extras.length > 0) await Promise.all(extras);
      setReporteImpresion({ a4: [], a3: [] });
      setSesionId("");
      setStep("confirmado");
      setSubmitting(false); submittingRef.current = false;
      enviarReporteEmail({ a4: [], a3: [] });
      return;
    }

    const mercado = mercados.find((m) => m.id === mercadoId);
    const inventarioUpdates: PromiseLike<void>[] = [];
    let reportSesionId = sesionId;

    if (modoEdicion) {
      // Actualizar mercado, fecha, trabajador, notas y materiales de la sesión
      await supabase.from("sesiones")
        .update({ mercado_id: mercadoId, fecha, trabajador: trabajador.trim(), notas: notas.trim() || null, materiales_faltantes: materiales, combos_a4: combosA4, combos_a3: combosA3 })
        .eq("id", sesionId);

      const marketChanged = mercadoId !== sesionMercadoIdOriginal;

      if (marketChanged) {
        // Revertir inventario del mercado original
        const oldMercado = mercados.find((m) => m.id === sesionMercadoIdOriginal);
        if (oldMercado) {
          const { data: oldInv } = await supabase.from("inventario").select("*").eq("caja_id", oldMercado.caja_id);
          for (const [key, cantidad] of Object.entries(ventasOriginales)) {
            const talla = key.slice(-2) as "A4" | "A3";
            const posterId = key.slice(0, -3);
            const invItem = (oldInv || []).find((i: { poster_id: string; talla: string; id: string; cantidad: number }) => i.poster_id === posterId && i.talla === talla);
            if (invItem) {
              inventarioUpdates.push(
                supabase.from("inventario").update({ cantidad: invItem.cantidad + cantidad, out: false }).eq("id", invItem.id).then(() => { return; })
              );
            }
          }
        }
        // Aplicar ventas al mercado nuevo (inventario ya cargado para el nuevo mercado)
        for (const [key, cantidad] of Object.entries(ventas)) {
          if (cantidad <= 0) continue;
          const talla = key.slice(-2) as "A4" | "A3";
          const posterId = key.slice(0, -3);
          const invItem = inventario.find((i) => i.poster_id === posterId && i.talla === talla);
          if (invItem) {
            const nuevaCantidad = Math.max(0, invItem.cantidad - cantidad);
            inventarioUpdates.push(
              supabase.from("inventario").update({ cantidad: nuevaCantidad, out: nuevaCantidad === 0 }).eq("id", invItem.id).then(() => { return; })
            );
          }
        }
        // Insertar primero las líneas nuevas; solo si funciona, borrar las viejas por id
        const { data: lineasViejasMc } = await supabase.from("ventas").select("id").eq("sesion_id", sesionId);
        const ventasInsert = Object.entries(ventas)
          .filter(([, c]) => c > 0)
          .map(([key, cantidad]) => ({ sesion_id: sesionId, poster_id: key.slice(0, -3), talla: key.slice(-2), cantidad }));
        if (ventasInsert.length > 0) {
          const { error: insertErrorMc } = await supabase.from("ventas").insert(ventasInsert);
          if (insertErrorMc) {
            alert(`${t.saveError}\n${insertErrorMc.message}`);
            setSubmitting(false); submittingRef.current = false;
            return;
          }
        }
        const idsViejosMc = (lineasViejasMc || []).map((l) => l.id);
        if (idsViejosMc.length > 0) {
          await supabase.from("ventas").delete().in("id", idsViejosMc);
        }
        await Promise.all(inventarioUpdates);

      } else {
        // Mismo mercado: calcular diferencias
        const allKeys = new Set([...Object.keys(ventasOriginales), ...Object.keys(ventas)]);
        const ventasUpsert: { sesion_id: string; poster_id: string; talla: string; cantidad: number }[] = [];

        for (const key of allKeys) {
          const talla = key.slice(-2) as "A4" | "A3";
          const posterId = key.slice(0, -3);
          const oldCantidad = ventasOriginales[key] || 0;
          const newCantidad = ventas[key] || 0;
          const diff = newCantidad - oldCantidad;

          if (diff !== 0) {
            const invItem = inventario.find((i) => i.poster_id === posterId && i.talla === talla);
            if (invItem) {
              const nuevaCantidad = Math.max(0, invItem.cantidad - diff);
              inventarioUpdates.push(
                supabase.from("inventario").update({ cantidad: nuevaCantidad, out: nuevaCantidad === 0 }).eq("id", invItem.id).then(() => { return; })
              );
            }
          }
          // Re-insertar TODAS las líneas con cantidad > 0 (no solo las cambiadas):
          // el delete de abajo borra todas las ventas de la sesión
          if (newCantidad > 0) ventasUpsert.push({ sesion_id: sesionId, poster_id: posterId, talla, cantidad: newCantidad });
        }

        // Insertar primero las líneas nuevas; solo si funciona, borrar las viejas por id
        const { data: lineasViejas } = await supabase.from("ventas").select("id").eq("sesion_id", sesionId);
        if (ventasUpsert.length > 0) {
          const { error: insertError } = await supabase.from("ventas").insert(ventasUpsert);
          if (insertError) {
            alert(`${t.saveError}\n${insertError.message}`);
            setSubmitting(false); submittingRef.current = false;
            return;
          }
        }
        const idsViejos = (lineasViejas || []).map((l) => l.id);
        if (idsViejos.length > 0) {
          await supabase.from("ventas").delete().in("id", idsViejos);
        }
        await Promise.all(inventarioUpdates);
      }

      setModoEdicion(false);
      setSesionMercadoIdOriginal("");

    } else {
      // MODO NORMAL: buscar o crear sesión
      const { data: sesionExistente } = await supabase
        .from("sesiones")
        .select("id")
        .eq("mercado_id", mercadoId)
        .eq("fecha", fecha)
        .maybeSingle();

      let nuevaSesionId: string;
      if (sesionExistente) {
        nuevaSesionId = sesionExistente.id;
        await supabase.from("sesiones").update({ notas: notas.trim() || null, materiales_faltantes: materiales, combos_a4: combosA4, combos_a3: combosA3 }).eq("id", nuevaSesionId);
      } else {
        const { data: nuevaSesion, error } = await supabase
          .from("sesiones")
          .insert({ mercado_id: mercadoId, fecha, trabajador: trabajador.trim(), notas: notas.trim() || null, materiales_faltantes: materiales, combos_a4: combosA4, combos_a3: combosA3 })
          .select()
          .single();
        if (error || !nuevaSesion) {
          alert(t.saveError);
          setSubmitting(false); submittingRef.current = false;
          return;
        }
        nuevaSesionId = nuevaSesion.id;
      }

      const { data: ventasExistentes } = await supabase
        .from("ventas").select("id, poster_id, talla, cantidad").eq("sesion_id", nuevaSesionId);
      const ventasExistMap: { [key: string]: { id: string; cantidad: number } } = {};
      for (const v of (ventasExistentes || [])) {
        ventasExistMap[`${v.poster_id}-${v.talla}`] = { id: v.id, cantidad: v.cantidad };
      }

      const ventasInsert: { sesion_id: string; poster_id: string; talla: string; cantidad: number }[] = [];
      const ventasUpdate: { id: string; cantidad: number }[] = [];

      for (const [key, cantidad] of Object.entries(ventas)) {
        if (cantidad <= 0) continue;
        const talla = key.slice(-2) as "A4" | "A3";
        const posterId = key.slice(0, -3);
        const existing = ventasExistMap[`${posterId}-${talla}`];
        if (existing) {
          ventasUpdate.push({ id: existing.id, cantidad: existing.cantidad + cantidad });
        } else {
          ventasInsert.push({ sesion_id: nuevaSesionId, poster_id: posterId, talla, cantidad });
        }
        if (mercado) {
          const invItem = inventario.find((i) => i.poster_id === posterId && i.talla === talla);
          if (invItem) {
            const nuevaCantidad = Math.max(0, invItem.cantidad - cantidad);
            inventarioUpdates.push(
              supabase.from("inventario").update({ cantidad: nuevaCantidad, out: nuevaCantidad === 0 }).eq("id", invItem.id).then(() => { return; })
            );
          }
        }
      }

      if (ventasInsert.length > 0) {
        const { error: insertErrorNuevo } = await supabase.from("ventas").insert(ventasInsert);
        if (insertErrorNuevo) {
          alert(`${t.saveError}\n${insertErrorNuevo.message}`);
          setSubmitting(false); submittingRef.current = false;
          return;
        }
      }
      await Promise.all([
        ...ventasUpdate.map((v) => supabase.from("ventas").update({ cantidad: v.cantidad }).eq("id", v.id)),
        ...inventarioUpdates,
      ]);
      setSesionId(nuevaSesionId);
      reportSesionId = nuevaSesionId;
    }

    const mercadoNombreGuardar = mercados.find((m) => m.id === mercadoId)?.nombre || "";
    const insertExtras: PromiseLike<unknown>[] = [];
    if (notas.trim()) {
      insertExtras.push(supabase.from("comisiones").insert({ texto: notas.trim(), fecha, mercado: mercadoNombreGuardar }));
    }
    if (ideas.trim()) {
      insertExtras.push(supabase.from("ideas").insert({ texto: ideas.trim(), fecha, mercado: mercadoNombreGuardar }));
    }
    if (insertExtras.length > 0) await Promise.all(insertExtras);

    // Aplicar lo marcado durante el cierre (sold out / falta sample, por póster)
    if (mercado) {
      const flagUpdates: PromiseLike<unknown>[] = [];
      for (const inv of inventario) {
        const key = `${inv.poster_id}-${inv.talla}`;
        const update: { sample_falta?: boolean; out?: boolean } = {};
        if (samplesFaltantes.has(key) && !inv.sample_falta) update.sample_falta = true;
        // sold out: aditivo — fuerza true en lo marcado; el resto lo decide la lógica de ventas
        if (soldOut.has(key) && !inv.out) update.out = true;
        if (Object.keys(update).length > 0) {
          flagUpdates.push(
            supabase.from("inventario").update(update).eq("id", inv.id).then(() => { return; })
          );
        }
      }
      if (flagUpdates.length > 0) await Promise.all(flagUpdates);
    }

    const reporte = await generarReporte(reportSesionId);

    setStep("confirmado");
    setSubmitting(false); submittingRef.current = false;
    // Enviar el reporte por email automáticamente al confirmar
    enviarReporteEmail(reporte);
  }

  async function generarReporte(sid: string) {
    const mercado = mercados.find((m) => m.id === mercadoId);
    const { data: todasVentas } = await supabase
      .from("ventas")
      .select("poster_id, talla, cantidad")
      .eq("sesion_id", sid);

    const { data: invActual } = mercado
      ? await supabase.from("inventario").select("*").eq("caja_id", mercado.caja_id)
      : { data: [] };

    // Agregar ventas por poster+talla
    const ventasAgrupadas: { [key: string]: number } = {};
    for (const v of (todasVentas || [])) {
      const key = `${v.poster_id}-${v.talla}`;
      ventasAgrupadas[key] = (ventasAgrupadas[key] || 0) + v.cantidad;
    }

    const a4: { linea: string; stockRestante: number }[] = [];
    const a3: { linea: string; stockRestante: number }[] = [];

    for (const [key, cantidad] of Object.entries(ventasAgrupadas)) {
      const talla = key.slice(-2);
      const posterId = key.slice(0, -3);
      const poster = posters.find((p) => p.id === posterId);
      if (!poster) continue;
      const invItem = (invActual || []).find((i: Inventario) => i.poster_id === posterId && i.talla === talla);
      const stockRestante = invItem?.cantidad ?? 0;
      const linea = `${cantidad}x ${poster.nombre}`;
      if (talla === "A4") a4.push({ linea, stockRestante });
      if (talla === "A3") a3.push({ linea, stockRestante });
    }

    setReporteImpresion({ a4, a3 });
    return { a4, a3 };
  }

  function handleEnviarReporte() {
    return enviarReporteEmail(reporteImpresion);
  }

  async function enviarReporteEmail(reporte: { a4: { linea: string; stockRestante: number }[]; a3: { linea: string; stockRestante: number }[] }) {
    setEnviandoEmail(true);
    setEmailEnviado(false);
    setEmailError("");
    const mercadoNombre = mercados.find((m) => m.id === mercadoId)?.nombre || "";
    const ahora = new Date().toLocaleTimeString("es-DE", { hour: "2-digit", minute: "2-digit" });
    try {
      const res = await fetch("/api/email/reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mercado: mercadoNombre,
          fecha,
          trabajador: trabajador.trim(),
          hora: ahora,
          a4: reporte.a4,
          a3: reporte.a3,
          notas: notas.trim(),
          ideas: ideas.trim(),
          materiales: materiales.map(k => t[k as MaterialKey]),
          totalA4,
          totalA3,
          combosA4,
          combosA3,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setEmailError(data.error || `HTTP ${res.status}`);
        setEnviandoEmail(false);
        return;
      }
      setEmailEnviado(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : String(err));
    }
    setEnviandoEmail(false);
  }

  const seriesIds = [...new Set(posters.map((p) => p.serie_id))].sort((a, b) => {
    const serieA = series.find((s) => s.id === a);
    const serieB = series.find((s) => s.id === b);
    const ia = SERIES_ORDER.indexOf(serieA?.nombre || "");
    const ib = SERIES_ORDER.indexOf(serieB?.nombre || "");
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const totalVentas = Object.values(ventas).reduce((a, b) => a + b, 0);
  // Desglose por talla: cuántos A4 y cuántos A3 lleva el cierre
  const totalA4 = Object.entries(ventas).reduce((a, [k, n]) => a + (k.endsWith("-A4") ? n : 0), 0);
  const totalA3 = Object.entries(ventas).reduce((a, [k, n]) => a + (k.endsWith("-A3") ? n : 0), 0);

  if (step === "confirmado") {
    const mercado = mercados.find((m) => m.id === mercadoId);
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-2 text-green-600">
            <CheckCircle size={56} strokeWidth={1.4} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t.sessionSaved}</h2>
          <p className="text-gray-500 text-sm">{t.inventoryUpdated}</p>
        </div>

        {/* Reporte de impresión */}
        {(reporteImpresion.a4.length > 0 || reporteImpresion.a3.length > 0) && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-black text-white px-4 py-3">
              <p className="font-bold flex items-center gap-2">
                <Printer size={16} /> {t.printReport}
              </p>
              <p className="text-xs text-gray-400">{mercado?.nombre} · {new Date(fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "long" })}</p>
            </div>

            {reporteImpresion.a4.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-600 mb-2">{t.sizeA4}</p>
                {reporteImpresion.a4.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Dot color={item.stockRestante < 5 ? "#f87171" : "#4ade80"} />
                      <span className="text-sm text-gray-800">{item.linea}</span>
                    </div>
                    {item.stockRestante >= 5
                      ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check size={12} /> {tr("stockOk", { n: item.stockRestante })}</span>
                      : <span className="text-xs text-red-600 font-medium flex items-center gap-1"><Printer size={12} /> {tr("printRemaining", { n: item.stockRestante })}</span>
                    }
                  </div>
                ))}
              </div>
            )}

            {reporteImpresion.a3.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">{t.sizeA3}</p>
                {reporteImpresion.a3.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Dot color={item.stockRestante < 5 ? "#f87171" : "#4ade80"} />
                      <span className="text-sm text-gray-800">{item.linea}</span>
                    </div>
                    {item.stockRestante >= 5
                      ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check size={12} /> {tr("stockOk", { n: item.stockRestante })}</span>
                      : <span className="text-xs text-red-600 font-medium flex items-center gap-1"><Printer size={12} /> {tr("printRemaining", { n: item.stockRestante })}</span>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Desglose del día: totales por talla y combos */}
        {(totalVentas > 0 || combosA4 > 0 || combosA3 > 0) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{t.dayBreakdown}</p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-yellow-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-yellow-600">{totalA4}</p>
                <p className="text-xs text-gray-500">{t.sizeA4}</p>
              </div>
              <div className="bg-blue-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-blue-600">{totalA3}</p>
                <p className="text-xs text-gray-500">{t.sizeA3}</p>
              </div>
            </div>
            {(combosA4 > 0 || combosA3 > 0) && (
              <p className="text-sm text-gray-700 mt-3 text-center">
                {t.combosTitle}: <span className="font-semibold text-yellow-600">{combosA4} A4</span> · <span className="font-semibold text-blue-600">{combosA3} A3</span>
              </p>
            )}
          </div>
        )}

        {/* Materiales */}
        {materiales.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-red-500">{t.standMaterials}</p>
            {materiales.map(k => (
              <p key={k} className="text-sm text-red-800">⚠ {t[k as MaterialKey]}</p>
            ))}
          </div>
        )}

        {/* Comisiones */}
        {notas.trim() && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{t.commissionsSection}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{notas.trim()}</p>
          </div>
        )}

        {/* Ideas */}
        {ideas.trim() && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">{t.ideasSection}</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{ideas.trim()}</p>
          </div>
        )}

        {/* Botón seguir editando (solo si hay sesión guardada) */}
        {sesionId && <button
          onClick={async () => {
            // Cargar ventas actuales de la sesión para pre-rellenar
            const mercado = mercados.find((m) => m.id === mercadoId);
            const { data: ventasActuales } = await supabase
              .from("ventas")
              .select("poster_id, talla, cantidad")
              .eq("sesion_id", sesionId);
            const map: { [key: string]: number } = {};
            for (const v of (ventasActuales || [])) {
              const key = `${v.poster_id}-${v.talla}`;
              map[key] = (map[key] || 0) + v.cantidad;
            }
            // Releer el stock fresco de la BD: tras el guardado, el inventario en
            // memoria quedó desfasado (nunca se re-descontó), y la rama de
            // diferencias del guardado usa este estado para calcular el nuevo stock.
            if (mercado) {
              const { data: invData } = await supabase
                .from("inventario").select("*").eq("caja_id", mercado.caja_id);
              if (invData) setInventario(invData);
            }
            setVentasOriginales({ ...map });
            setVentas({ ...map });
            // Marcar el mercado original = actual, para que el guardado tome la rama
            // "mismo mercado" (diferencias) y no la de cambio de mercado.
            setSesionMercadoIdOriginal(mercadoId);
            setModoEdicion(true);
            setEmailEnviado(false);
            setStep("ventas");
          }}
          className="w-full border-2 border-black text-black py-3 rounded-2xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <Pencil size={16} /> {t.keepEditing}
        </button>}

        {/* Botones compartir / email reporte */}
        {(reporteImpresion.a4.length > 0 || reporteImpresion.a3.length > 0 || notas.trim() || ideas.trim() || materiales.length > 0) && (
          <div className="space-y-2">
            <button
              onClick={async () => {
                const fechaFmt = new Date(fecha + "T12:00:00").toLocaleDateString("es-DE", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                });
                const linesA4 = reporteImpresion.a4.map(i =>
                  `[${i.stockRestante < 5 ? "!" : "OK"}] ${i.linea} — ${i.stockRestante < 5 ? `imprimir (quedan ${i.stockRestante})` : `stock ok (${i.stockRestante})`}`
                ).join("\n");
                const linesA3 = reporteImpresion.a3.map(i =>
                  `[${i.stockRestante < 5 ? "!" : "OK"}] ${i.linea} — ${i.stockRestante < 5 ? `imprimir (quedan ${i.stockRestante})` : `stock ok (${i.stockRestante})`}`
                ).join("\n");
                const materialesBlock = materiales.length > 0 ? `\n\n— MATERIALES —\n${materiales.map(k => `⚠ ${t[k as MaterialKey]}`).join("\n")}` : "";
                const notasBlock = notas.trim() ? `\n\n— COMISIONES —\n${notas.trim()}` : "";
                const ideasBlock = ideas.trim() ? `\n\n— IDEAS —\n${ideas.trim()}` : "";
                const desgloseBlock = totalVentas > 0 ? `\n\n— TOTALES —\nA4: ${totalA4} · A3: ${totalA3}${combosA4 > 0 || combosA3 > 0 ? `\nCombos x3: ${combosA4} A4 · ${combosA3} A3` : ""}` : "";
                const texto = `REPORTE DE SESIÓN\n${mercado?.nombre || ""}\n${fechaFmt}\n${trabajador}\n\n${linesA4 ? `— A4 —\n${linesA4}\n\n` : ""}${linesA3 ? `— A3 —\n${linesA3}` : ""}${desgloseBlock}${materialesBlock}${notasBlock}${ideasBlock}`.trim();

                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `Reporte de impresión — ${mercado?.nombre || ""}`,
                      text: texto,
                    });
                  } catch {
                    // usuario canceló, no hacer nada
                  }
                } else if (navigator.clipboard) {
                  await navigator.clipboard.writeText(texto);
                  alert("Reporte copiado al portapapeles");
                } else {
                  alert(texto);
                }
              }}
              className="w-full bg-black text-white py-3 rounded-2xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {t.shareReport}
            </button>

            {/* Estado del envío automático: solo hay botón si falló */}
            {enviandoEmail && (
              <div className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-semibold flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse inline-block" />
                {t.sending}
              </div>
            )}
            {!enviandoEmail && emailEnviado && (
              <div className="w-full py-3 rounded-2xl bg-green-100 text-green-700 font-semibold flex items-center justify-center gap-2">
                <Check size={16} /> {t.reportSent}
              </div>
            )}
            {!enviandoEmail && !emailEnviado && (
              <div className="space-y-2">
                {emailError && (
                  <p className="text-xs text-red-600 text-center">{emailError}</p>
                )}
                <button
                  onClick={handleEnviarReporte}
                  className="w-full py-3 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 bg-red-50 border-2 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 7l-10 6L2 7" />
                  </svg>
                  {t.retryEmail}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            setStep("info");
            setVentas({});
            setTrabajador("");
            setNotas("");
            setIdeas("");
            setMateriales([]);
            setCombosA4(0);
            setCombosA3(0);
            setReporteImpresion({ a4: [], a3: [] });
            setSesionId("");
            setEmailEnviado(false);
            setEmailError("");
          }}
          className="w-full bg-black text-white px-6 py-3 rounded-2xl font-semibold hover:bg-gray-900"
        >
          {t.newSession}
        </button>
      </div>
    );
  }

  if (step === "info") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.sessions}</h1>
          <p className="text-gray-500 text-sm">{t.sessionsSubtitle}</p>
        </div>

        {/* Tabs principales */}
        <div className="flex gap-2">
          <button
            onClick={() => setTabPrincipal("nueva")}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tabPrincipal === "nueva" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t.newSession}
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

        {/* Historial */}
        {tabPrincipal === "historial" && (
          <div className="space-y-3">
            {loadingHistorial ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl animate-pulse" />)}
              </div>
            ) : (() => {
              // Calendario
              const [cy, cm] = calendarMonth.split("-").map(Number);
              const firstDow = new Date(cy, cm - 1, 1).getDay();
              const startOffset = firstDow === 0 ? 6 : firstDow - 1;
              const daysInMonth = new Date(cy, cm, 0).getDate();
              const sessionDates = new Set(historial.map(s => s.fecha));

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
                ? historial.filter(s => s.fecha === selectedDate)
                : historial;

              const porMes = filtered.reduce((acc, s) => {
                const key = s.fecha.slice(0, 7);
                (acc[key] = acc[key] || []).push(s);
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
                    {t.calDays.map(d => (
                      <span key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1">
                    {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${calendarMonth}-${String(day).padStart(2, "0")}`;
                      const hasSessions = sessionDates.has(dateStr);
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button
                          key={day}
                          onClick={() => hasSessions && setSelectedDate(isSelected ? null : dateStr)}
                          className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                            ${isSelected ? "bg-black text-white font-bold" :
                              hasSessions ? "bg-gray-900 text-white font-semibold hover:bg-gray-700" :
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
                    <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-700 underline">{t.viewAll}</button>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">{t.noSessionsThisDay}</div>
                ) : meses.map((mes) => (
                <div key={mes} className="space-y-2">
                  {!selectedDate && <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-1">
                    {new Date(mes + "-01T12:00:00").toLocaleDateString("es-DE", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase())}
                  </p>}
                  {porMes[mes].map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setHistorialAbierto(historialAbierto === s.id ? null : s.id)}
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{s.mercadoNombre}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(s.fecha + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long" })} · {s.trabajador}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{tr("sold", { n: s.totalVentas })}</p>
                    </div>
                    <span className="text-gray-400">{historialAbierto === s.id ? "▲" : "▼"}</span>
                  </div>
                </button>
                {historialAbierto === s.id && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                    <div className="grid grid-cols-[1fr_40px_40px] gap-x-3 gap-y-1.5">
                      <span className="text-xs font-semibold text-gray-400">{t.poster}</span>
                      <span className="text-xs font-semibold text-gray-400 text-center">A4</span>
                      <span className="text-xs font-semibold text-gray-400 text-center">A3</span>
                      {Object.entries(
                        s.lineas.reduce((acc, l) => {
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
                    {/* Totales por talla y combos del día */}
                    <div className="border-t border-gray-100 pt-2 text-xs font-medium">
                      <span className="text-yellow-600">A4: {s.lineas.filter(l => l.talla === "A4").reduce((a, l) => a + l.cantidad, 0)}</span>
                      <span className="text-gray-300"> · </span>
                      <span className="text-blue-600">A3: {s.lineas.filter(l => l.talla === "A3").reduce((a, l) => a + l.cantidad, 0)}</span>
                      {(s.combosA4 > 0 || s.combosA3 > 0) && (
                        <span className="text-gray-600"> · {t.combosTitle}: {s.combosA4} A4 / {s.combosA3} A3</span>
                      )}
                    </div>
                    {/* Cuadre del cierre con el dinero del balance */}
                    {s.cuadre && (
                      <div className={`rounded-xl px-3 py-2.5 border ${s.cuadre.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-bold uppercase tracking-widest ${s.cuadre.ok ? "text-green-600" : "text-red-500"}`}>
                            {s.cuadre.ok ? t.reconcileOk : t.reconcileOff}
                          </p>
                          <p className={`text-sm font-bold ${s.cuadre.ok ? "text-green-700" : "text-red-600"}`}>
                            {s.cuadre.diff > 0 ? "+" : ""}{eur(s.cuadre.diff)}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {t.reconcileExpected}: {eur(s.cuadre.esperado)} · {t.reconcileReal}: {eur(s.cuadre.real)}
                        </p>
                        {!s.cuadre.ok && (
                          <p className="text-xs text-red-600 mt-1">{s.cuadre.diff > 0 ? t.reconcileMore : t.reconcileLess}</p>
                        )}
                      </div>
                    )}
                    {/* Materiales que faltaban en la caja ese día */}
                    {s.materiales.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">{t.standMaterials}</p>
                        {s.materiales.map(k => (
                          <p key={k} className="text-xs text-red-800">⚠ {t[k as MaterialKey]}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => editarSesionDesdeHistorial(s)}
                        className="flex-1 border-2 border-black text-black py-2 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        {t.edit}
                      </button>
                      <button
                        onClick={() => eliminarSesion(s)}
                        className="border-2 border-red-200 text-red-500 py-2 px-4 rounded-xl font-semibold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                        {t.delete}
                      </button>
                    </div>
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

        {tabPrincipal === "nueva" && <><div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t.market}</label>
            <div className="grid grid-cols-1 gap-2">
              {mercados.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMercadoId(m.id)}
                  className={`text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                    mercadoId === m.id ? "border-black bg-black text-white" : "border-gray-300 text-gray-900 hover:border-gray-500"
                  }`}
                >
                  <span className="font-medium">{m.nombre}</span>
                  <span className={`ml-2 text-xs capitalize ${mercadoId === m.id ? "opacity-60" : "text-gray-600"} ${m.dia_semana === "especial" ? "italic" : ""}`}>
                    {m.dia_semana === "especial" ? t.specialMarket : m.dia_semana}
                  </span>
                </button>
              ))}

              {/* Formulario nuevo mercado */}
              {nuevoMercado ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    placeholder={t.marketName}
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                    autoFocus
                  />
                  <select
                    value={nuevaCajaId}
                    onChange={(e) => setNuevaCajaId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black bg-white"
                  >
                    <option value="">{t.selectBox}</option>
                    {cajas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCrearMercado}
                      disabled={!nuevoNombre.trim() || !nuevaCajaId || guardandoMercado}
                      className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                    >
                      {guardandoMercado ? t.saving : t.createMarket}
                    </button>
                    <button
                      onClick={() => { setNuevoMercado(false); setNuevoNombre(""); setNuevaCajaId(""); }}
                      className="px-4 py-2 rounded-lg text-sm text-gray-500 bg-gray-100"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNuevoMercado(true)}
                  className="text-left px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
                >
                  {t.addSpecialMarket}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t.date}</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t.worker}</label>
            <input
              type="text"
              value={trabajador}
              onChange={(e) => setTrabajador(e.target.value)}
              placeholder={t.workerName}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {modoEdicion ? (
          <>
            {/* Modo edición: guardar solo datos o entrar a editar ventas */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-700">
              {t.editingSessionBanner}
            </div>
            <button
              onClick={guardarSoloInfo}
              disabled={!mercadoId || !trabajador.trim() || guardandoInfo || mercadoId !== sesionMercadoIdOriginal}
              className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg disabled:opacity-40 hover:bg-gray-900 transition-colors"
            >
              {guardandoInfo ? t.saving : t.saveInfoOnly}
            </button>
            {mercadoId !== sesionMercadoIdOriginal && (
              <p className="text-xs text-amber-600 text-center -mt-3">{t.marketChangeNeedsSales}</p>
            )}
            <button
              onClick={handleIniciar}
              disabled={!mercadoId || !trabajador.trim()}
              className="w-full border-2 border-black text-black py-3.5 rounded-2xl font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              {t.editSalesBtn}
            </button>
            <button
              onClick={cancelarEdicion}
              className="w-full text-sm text-gray-400 hover:text-gray-700 underline py-1"
            >
              {t.cancel}
            </button>
          </>
        ) : (
          <button
            onClick={handleIniciar}
            disabled={!mercadoId || !trabajador.trim()}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg disabled:opacity-40 hover:bg-gray-900 transition-colors"
          >
            {t.registerSales}
          </button>
        )}

        {/* Mercado cancelado (calor, lluvia...): se registra como contexto, sin tocar ventas */}
        {cAviso && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3">✓ {cAviso}</div>}
        {cancelAbierto ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.cancelMarketTitle}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.market}</label>
                <select value={cMercadoId} onChange={(e) => setCMercadoId(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black">
                  <option value="">{t.selectBox}</option>
                  {mercados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.date}</label>
                <input type="date" value={cFecha} onChange={(e) => setCFecha(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.cancelReason}</label>
              <input type="text" value={cMotivo} onChange={(e) => setCMotivo(e.target.value)} placeholder={t.cancelReasonPh} className="w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={registrarCancelacion}
                disabled={!cMercadoId || !cFecha || cGuardando}
                className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
              >
                {cGuardando ? t.saving : t.saveCancellation}
              </button>
              <button onClick={() => setCancelAbierto(false)} className="px-4 text-sm text-gray-400">{t.cancel}</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCancelAbierto(true)}
            className="w-full text-sm text-gray-400 hover:text-gray-700 underline py-1"
          >
            {t.marketCancelledQ}
          </button>
        )}
        </>}
      </div>
    );
  }

  const mercado = mercados.find((m) => m.id === mercadoId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.salesOfDay}</h1>
        <p className="text-gray-500 text-sm">
          {mercado?.nombre} · {new Date(fecha + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long" })} · {trabajador}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <SkeletonList rows={5} />
          <SkeletonList rows={6} />
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {seriesIds.map((sid) => {
              const serie = series.find((s) => s.id === sid);
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
                  <div
                    className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg mb-2 inline-block"
                    style={{ backgroundColor: (serie?.color || "#6B7280") + "22", color: serie?.color || "#6B7280" }}
                  >
                    {serie?.nombre}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-700">{t.poster}</span>
                      <span className="text-xs font-semibold text-gray-700 text-center">A4</span>
                      <span className="text-xs font-semibold text-gray-700 text-center">A3</span>
                    </div>
                    {sp.map((p, idx) => {
                      const invA4 = inventario.find((i) => i.poster_id === p.id && i.talla === "A4");
                      const invA3 = inventario.find((i) => i.poster_id === p.id && i.talla === "A3");
                      return (
                        <div
                          key={p.id}
                          className={`grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-3 items-center ${idx < sp.length - 1 ? "border-b border-gray-100" : ""}`}
                        >
                          <span className="text-sm text-gray-900 font-medium min-w-0 truncate">{p.nombre}</span>
                          {p.tiene_a4 ? (
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min={0}
                                max={invA4?.cantidad || 99}
                                value={ventas[`${p.id}-A4`] || ""}
                                placeholder="0"
                                onChange={(e) => setVenta(p.id, "A4", parseInt(e.target.value) || 0)}
                                onBlur={(e) => setVenta(p.id, "A4", parseInt(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                className="w-16 text-center text-sm text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:border-black"
                              />
                              {invA4 && <span className="text-xs text-gray-600 font-medium">/{invA4.cantidad}</span>}
                              <FlagsTalla posterId={p.id} talla="A4" />
                            </div>
                          ) : <div />}
                          {p.tiene_a3 ? (
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min={0}
                                max={invA3?.cantidad || 99}
                                value={ventas[`${p.id}-A3`] || ""}
                                placeholder="0"
                                onChange={(e) => setVenta(p.id, "A3", parseInt(e.target.value) || 0)}
                                onBlur={(e) => setVenta(p.id, "A3", parseInt(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                className="w-16 text-center text-sm text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:border-black"
                              />
                              {invA3 && <span className="text-xs text-gray-600 font-medium">/{invA3.cantidad}</span>}
                              <FlagsTalla posterId={p.id} talla="A3" />
                            </div>
                          ) : <div />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Materiales faltantes */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">{t.standMaterials}</p>
            <div className="grid grid-cols-2 gap-2">
              {MATERIALES_KEYS.map((key) => {
                const falta = materiales.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => setMateriales(prev => falta ? prev.filter(k => k !== key) : [...prev, key])}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-colors text-left ${falta ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${falta ? "bg-red-500 border-red-500" : "border-gray-300"}`}>
                      {falta && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className={`text-xs font-medium leading-tight ${falta ? "text-red-700" : "text-gray-600"}`}>{t[key as MaterialKey]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combos vendidos (packs de 3 con descuento) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-700">{t.combosTitle}</p>
            <p className="text-xs text-gray-400 mb-3">{t.combosHint}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-yellow-600 uppercase tracking-widest mb-1">{t.combosA4Label}</label>
                <input
                  type="number" inputMode="numeric" pattern="[0-9]*" min={0}
                  value={combosA4 || ""} placeholder="0"
                  onChange={(e) => setCombosA4(Math.max(0, parseInt(e.target.value) || 0))}
                  onFocus={(e) => e.target.select()}
                  className="w-full text-center text-gray-900 border border-gray-300 rounded-xl py-2.5 focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">{t.combosA3Label}</label>
                <input
                  type="number" inputMode="numeric" pattern="[0-9]*" min={0}
                  value={combosA3 || ""} placeholder="0"
                  onChange={(e) => setCombosA3(Math.max(0, parseInt(e.target.value) || 0))}
                  onFocus={(e) => e.target.select()}
                  className="w-full text-center text-gray-900 border border-gray-300 rounded-xl py-2.5 focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Comisiones */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">{t.commissionsTitle}</label>
              {mercado && <span className="text-xs text-gray-400">{mercado.nombre}</span>}
            </div>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={t.commissionsPlaceholder}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black resize-none"
            />
          </div>

          {/* Ideas */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-amber-800">{t.ideasTitle}</label>
              {mercado && <span className="text-xs text-amber-500">{mercado.nombre}</span>}
            </div>
            <textarea
              value={ideas}
              onChange={(e) => setIdeas(e.target.value)}
              placeholder={t.ideasPlaceholder}
              rows={3}
              className="w-full border border-amber-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="sticky bottom-20 bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{tr("totalSales", { n: totalVentas })}</p>
              {totalVentas > 0 && (
                <p className="text-xs font-medium">
                  <span className="text-yellow-600">A4: {totalA4}</span>
                  <span className="text-gray-300"> · </span>
                  <span className="text-blue-600">A3: {totalA3}</span>
                </p>
              )}
              <p className="text-xs text-gray-500">{t.confirmUpdate}</p>
            </div>
            <button
              onClick={openReview}
              disabled={submitting || (totalVentas === 0 && !notas.trim() && !ideas.trim() && materiales.length === 0)}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors"
            >
              {submitting ? t.saving : t.confirm}
            </button>
          </div>
        </>
      )}

      {/* Review overlay — employee verifies numbers before saving */}
      {showReview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[88vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{t.reviewTitle}</h3>
                <p className="text-xs text-gray-400">
                  {tr("totalSales", { n: totalVentas })}
                  {totalVentas > 0 && <> · <span className="text-yellow-600 font-medium">A4: {totalA4}</span> · <span className="text-blue-600 font-medium">A3: {totalA3}</span></>}
                </p>
              </div>
              <button
                onClick={() => setShowReview(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Ventas table — editable, ordered by series like the physical inventory */}
              {(() => {
                if (reviewPosterIdsRef.current.size === 0) return null;
                const sortedSeriesIds = [...new Set(posters.map(p => p.serie_id))].sort((a, b) => {
                  const ia = SERIES_ORDER.indexOf(series.find(s => s.id === a)?.nombre || "");
                  const ib = SERIES_ORDER.indexOf(series.find(s => s.id === b)?.nombre || "");
                  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                });
                return (
                  <div className="space-y-3">
                    {sortedSeriesIds.map(sid => {
                      const serie = series.find(s => s.id === sid);
                      const orden = POSTERS_ORDER[serie?.nombre || ""] || [];
                      const sp = posters
                        .filter(p => p.serie_id === sid)
                        .sort((a, b) => {
                          const ia = orden.indexOf(a.nombre);
                          const ib = orden.indexOf(b.nombre);
                          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                        })
                        .filter(p => reviewPosterIdsRef.current.has(p.id));
                      if (sp.length === 0) return null;
                      return (
                        <div key={sid}>
                          <div
                            className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-lg mb-2 inline-block"
                            style={{ backgroundColor: (serie?.color || "#6B7280") + "22", color: serie?.color || "#6B7280" }}
                          >
                            {serie?.nombre}
                          </div>
                          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                            <div className="grid grid-cols-[1fr_56px_56px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                              <span className="text-xs font-semibold text-gray-500">{t.poster}</span>
                              <span className="text-xs font-semibold text-yellow-600 text-center">A4</span>
                              <span className="text-xs font-semibold text-blue-600 text-center">A3</span>
                            </div>
                            {sp.map((p, i) => {
                              const invA4 = inventario.find(inv => inv.poster_id === p.id && inv.talla === "A4");
                              const invA3 = inventario.find(inv => inv.poster_id === p.id && inv.talla === "A3");
                              return (
                                <div key={p.id} className={`grid grid-cols-[1fr_56px_56px] gap-2 px-4 py-2 items-center ${i < sp.length - 1 ? "border-b border-gray-100" : ""}`}>
                                  <span className="text-sm text-gray-900 leading-tight">{p.nombre}</span>
                                  {p.tiene_a4 ? (
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min={0}
                                        max={invA4?.cantidad ?? 99}
                                        value={ventas[`${p.id}-A4`] || ""}
                                        placeholder="0"
                                        onChange={(e) => setVenta(p.id, "A4", parseInt(e.target.value) || 0)}
                                        onFocus={(e) => e.target.select()}
                                        className="w-12 text-center text-sm font-bold text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:border-black"
                                      />
                                      {invA4 && <span className="text-xs text-gray-400">/{invA4.cantidad}</span>}
                                    </div>
                                  ) : <div />}
                                  {p.tiene_a3 ? (
                                    <div className="flex flex-col items-center">
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min={0}
                                        max={invA3?.cantidad ?? 99}
                                        value={ventas[`${p.id}-A3`] || ""}
                                        placeholder="0"
                                        onChange={(e) => setVenta(p.id, "A3", parseInt(e.target.value) || 0)}
                                        onFocus={(e) => e.target.select()}
                                        className="w-12 text-center text-sm font-bold text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:border-black"
                                      />
                                      {invA3 && <span className="text-xs text-gray-400">/{invA3.cantidad}</span>}
                                    </div>
                                  ) : <div />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Sold out / Falta sample marcados durante el cierre */}
              {(soldOut.size > 0 || samplesFaltantes.size > 0) && (() => {
                const desc = (key: string) => {
                  const talla = key.slice(-2);
                  const pid = key.slice(0, -3);
                  return `${posters.find((p) => p.id === pid)?.nombre || "—"} ${talla}`;
                };
                const outs = [...soldOut].map(desc).sort();
                const samples = [...samplesFaltantes].map(desc).sort();
                return (
                  <div className="space-y-2">
                    {outs.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">{t.soldOutTitle}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {outs.map((x) => <span key={x} className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">{x}</span>)}
                        </div>
                      </div>
                    )}
                    {samples.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">{t.missingSampleTitle}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {samples.map((x) => <span key={x} className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">{x}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Materiales */}
              {materiales.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">{t.standMaterials}</p>
                  {materiales.map(k => (
                    <p key={k} className="text-sm text-red-800">⚠ {t[k as MaterialKey]}</p>
                  ))}
                </div>
              )}

              {/* Comisiones */}
              {notas.trim() && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{t.commissionsSection}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notas.trim()}</p>
                </div>
              )}

              {/* Ideas */}
              {ideas.trim() && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-1">{t.ideasSection}</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{ideas.trim()}</p>
                </div>
              )}
            </div>
            <div className="p-4 flex gap-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
              >
                {t.edit}
              </button>
              <button
                onClick={() => { setShowReview(false); handleSubmit(); }}
                disabled={submitting}
                className="flex-1 bg-black text-white py-3 rounded-2xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors"
              >
                {submitting ? t.saving : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
