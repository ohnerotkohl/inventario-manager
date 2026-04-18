"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Mercado, Poster, Serie, Inventario } from "@/lib/types";
import { SkeletonList } from "@/app/components/Skeleton";

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

type Step = "info" | "ventas" | "confirmado";

interface PosterConSeries extends Poster {
  series?: Serie;
}

interface VentaEntry {
  poster_id: string;
  talla: "A4" | "A3";
  cantidad: number;
}

export default function SesionPage() {
  const [step, setStep] = useState<Step>("info");
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [mercadoId, setMercadoId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [trabajador, setTrabajador] = useState("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConSeries[]>([]);
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [ventas, setVentas] = useState<{ [key: string]: number }>({});
  const [cajas, setCajas] = useState<{ id: string; nombre: string }[]>([]);
  const [nuevoMercado, setNuevoMercado] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCajaId, setNuevaCajaId] = useState("");
  const [guardandoMercado, setGuardandoMercado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [sesionId, setSesionId] = useState("");
  const [ventasOriginales, setVentasOriginales] = useState<{ [key: string]: number }>({});
  const [modoEdicion, setModoEdicion] = useState(false);
  const [reporteImpresion, setReporteImpresion] = useState<{ a4: { linea: string; stockRestante: number }[]; a3: { linea: string; stockRestante: number }[] }>({ a4: [], a3: [] });

  useEffect(() => {
    supabase.from("mercados").select("*, cajas(*)").then(({ data }) => {
      setMercados(data || []);
      if (data && data.length > 0) setMercadoId(data[0].id);
    });
    supabase.from("cajas").select("id, nombre").then(({ data }) => {
      setCajas(data || []);
    });
  }, []);

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
    setLoading(false);
  }

  function handleIniciar() {
    if (!mercadoId || !trabajador.trim()) return;
    cargarPosters();
    setStep("ventas");
  }

  function setVenta(posterId: string, talla: "A4" | "A3", cantidad: number) {
    setVentas((prev) => ({ ...prev, [`${posterId}-${talla}`]: Math.max(0, cantidad) }));
  }

  async function handleSubmit() {
    setSubmitting(true);

    // Buscar si ya existe sesión para este mercado+fecha
    const { data: sesionExistente } = await supabase
      .from("sesiones")
      .select("id")
      .eq("mercado_id", mercadoId)
      .eq("fecha", fecha)
      .maybeSingle();

    let sesionId: string;

    if (sesionExistente) {
      sesionId = sesionExistente.id;
    } else {
      const { data: nuevaSesion, error } = await supabase
        .from("sesiones")
        .insert({ mercado_id: mercadoId, fecha, trabajador: trabajador.trim() })
        .select()
        .single();
      if (error || !nuevaSesion) {
        alert("Error guardando la sesión. Intenta de nuevo.");
        setSubmitting(false);
        return;
      }
      sesionId = nuevaSesion.id;
    }

    const mercado = mercados.find((m) => m.id === mercadoId);
    const inventarioUpdates: PromiseLike<void>[] = [];

    if (modoEdicion) {
      // MODO EDICIÓN: calcular diferencias respecto a lo original y actualizar
      const { data: ventasExistentes } = await supabase
        .from("ventas")
        .select("id, poster_id, talla, cantidad")
        .eq("sesion_id", sesionId);

      const ventasExistMap: { [key: string]: { id: string; cantidad: number } } = {};
      for (const v of (ventasExistentes || [])) {
        ventasExistMap[`${v.poster_id}-${v.talla}`] = { id: v.id, cantidad: v.cantidad };
      }

      const allKeys = new Set([...Object.keys(ventasOriginales), ...Object.keys(ventas)]);
      const ventasUpsert: { sesion_id: string; poster_id: string; talla: string; cantidad: number }[] = [];
      const ventasDelete: string[] = [];

      for (const key of allKeys) {
        const talla = key.slice(-2) as "A4" | "A3";
        const posterId = key.slice(0, -3);
        const oldCantidad = ventasOriginales[key] || 0;
        const newCantidad = ventas[key] || 0;
        const diff = newCantidad - oldCantidad;

        if (diff === 0) continue;

        const invItem = inventario.find((i) => i.poster_id === posterId && i.talla === talla);
        if (invItem) {
          const nuevaCantidad = Math.max(0, invItem.cantidad - diff);
          inventarioUpdates.push(
            supabase.from("inventario")
              .update({ cantidad: nuevaCantidad, out: nuevaCantidad === 0 })
              .eq("id", invItem.id)
              .then(() => { return; })
          );
        }

        if (newCantidad > 0) {
          ventasUpsert.push({ sesion_id: sesionId, poster_id: posterId, talla, cantidad: newCantidad });
        } else {
          const existing = ventasExistMap[key];
          if (existing) ventasDelete.push(existing.id);
        }
      }

      await Promise.all([
        supabase.from("ventas").delete().eq("sesion_id", sesionId),
        ...inventarioUpdates,
      ]);
      if (ventasUpsert.length > 0) {
        await supabase.from("ventas").insert(ventasUpsert);
      }
      setModoEdicion(false);

    } else {
      // MODO NORMAL: fusionar con sesión existente si la hay
      const { data: ventasExistentes } = await supabase
        .from("ventas")
        .select("id, poster_id, talla, cantidad")
        .eq("sesion_id", sesionId);

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
          ventasInsert.push({ sesion_id: sesionId, poster_id: posterId, talla, cantidad });
        }

        if (mercado) {
          const invItem = inventario.find((i) => i.poster_id === posterId && i.talla === talla);
          if (invItem) {
            const nuevaCantidad = Math.max(0, invItem.cantidad - cantidad);
            inventarioUpdates.push(
              supabase.from("inventario")
                .update({ cantidad: nuevaCantidad, out: nuevaCantidad === 0 })
                .eq("id", invItem.id)
                .then(() => { return; })
            );
          }
        }
      }

      await Promise.all([
        ventasInsert.length > 0 ? supabase.from("ventas").insert(ventasInsert) : Promise.resolve(),
        ...ventasUpdate.map((v) => supabase.from("ventas").update({ cantidad: v.cantidad }).eq("id", v.id)),
        ...inventarioUpdates,
      ]);
    }

    // Generar reporte completo desde la sesión (todas las ventas, no solo las nuevas)
    setSesionId(sesionId);
    await generarReporte(sesionId);

    setStep("confirmado");
    setSubmitting(false);
    setEmailEnviado(false);
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
  }

  async function handleEnviarReporte() {
    setEnviandoEmail(true);
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
          a4: reporteImpresion.a4,
          a3: reporteImpresion.a3,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        alert(`Error enviando el email:\n${data.error || `HTTP ${res.status}`}`);
        setEnviandoEmail(false);
        return;
      }
      setEmailEnviado(true);
    } catch (err) {
      alert(`Error de red: ${err instanceof Error ? err.message : String(err)}`);
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

  if (step === "confirmado") {
    const mercado = mercados.find((m) => m.id === mercadoId);
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-2">✅</div>
          <h2 className="text-2xl font-bold text-gray-900">¡Sesión guardada!</h2>
          <p className="text-gray-500 text-sm">Inventario actualizado correctamente</p>
        </div>

        {/* Reporte de impresión */}
        {(reporteImpresion.a4.length > 0 || reporteImpresion.a3.length > 0) && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-black text-white px-4 py-3">
              <p className="font-bold">🖨️ Reporte de impresión</p>
              <p className="text-xs text-gray-400">{mercado?.nombre} · {new Date(fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "long" })}</p>
            </div>

            {reporteImpresion.a4.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-yellow-600 mb-2">Tamaño A4</p>
                {reporteImpresion.a4.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.stockRestante < 5 ? "bg-red-400" : "bg-green-400"}`} />
                      <span className="text-sm text-gray-800">{item.linea}</span>
                    </div>
                    {item.stockRestante >= 5
                      ? <span className="text-xs text-green-600 font-medium">✓ Stock ok ({item.stockRestante})</span>
                      : <span className="text-xs text-red-600 font-medium">🖨️ Imprimir (quedan {item.stockRestante})</span>
                    }
                  </div>
                ))}
              </div>
            )}

            {reporteImpresion.a3.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Tamaño A3</p>
                {reporteImpresion.a3.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.stockRestante < 5 ? "bg-red-400" : "bg-green-400"}`} />
                      <span className="text-sm text-gray-800">{item.linea}</span>
                    </div>
                    {item.stockRestante >= 5
                      ? <span className="text-xs text-green-600 font-medium">✓ Stock ok ({item.stockRestante})</span>
                      : <span className="text-xs text-red-600 font-medium">🖨️ Imprimir (quedan {item.stockRestante})</span>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Botón seguir editando */}
        <button
          onClick={async () => {
            // Cargar ventas actuales de la sesión para pre-rellenar
            const { data: ventasActuales } = await supabase
              .from("ventas")
              .select("poster_id, talla, cantidad")
              .eq("sesion_id", sesionId);
            const map: { [key: string]: number } = {};
            for (const v of (ventasActuales || [])) {
              const key = `${v.poster_id}-${v.talla}`;
              map[key] = (map[key] || 0) + v.cantidad;
            }
            setVentasOriginales({ ...map });
            setVentas({ ...map });
            setModoEdicion(true);
            setEmailEnviado(false);
            setStep("ventas");
          }}
          className="w-full border-2 border-black text-black py-3 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
        >
          ✏️ Seguir editando esta sesión
        </button>

        {/* Botones compartir / email reporte */}
        {(reporteImpresion.a4.length > 0 || reporteImpresion.a3.length > 0) && (
          <div className="space-y-2">
            <button
              onClick={async () => {
                const fechaFmt = new Date(fecha + "T12:00:00").toLocaleDateString("es-DE", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                });
                const linesA4 = reporteImpresion.a4.map(i =>
                  `${i.stockRestante < 5 ? "🖨️" : "✓"} ${i.linea} — ${i.stockRestante < 5 ? `imprimir (quedan ${i.stockRestante})` : `stock ok (${i.stockRestante})`}`
                ).join("\n");
                const linesA3 = reporteImpresion.a3.map(i =>
                  `${i.stockRestante < 5 ? "🖨️" : "✓"} ${i.linea} — ${i.stockRestante < 5 ? `imprimir (quedan ${i.stockRestante})` : `stock ok (${i.stockRestante})`}`
                ).join("\n");
                const texto = `🖨️ REPORTE DE IMPRESIÓN\n${mercado?.nombre || ""}\n${fechaFmt}\n${trabajador}\n\n${linesA4 ? `— A4 —\n${linesA4}\n\n` : ""}${linesA3 ? `— A3 —\n${linesA3}` : ""}`.trim();

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
              className="w-full bg-black text-white py-3 rounded-2xl font-semibold hover:bg-gray-800 transition-colors"
            >
              📲 Compartir / guardar reporte
            </button>

            <button
              onClick={handleEnviarReporte}
              disabled={enviandoEmail || emailEnviado}
              className={`w-full py-3 rounded-2xl font-semibold transition-colors ${
                emailEnviado
                  ? "bg-green-100 text-green-700"
                  : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              } disabled:opacity-60`}
            >
              {enviandoEmail ? "Enviando..." : emailEnviado ? "✓ Reporte enviado" : "📧 Enviar por email"}
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setStep("info");
            setVentas({});
            setTrabajador("");
            setReporteImpresion({ a4: [], a3: [] });
            setSesionId("");
            setEmailEnviado(false);
          }}
          className="w-full bg-black text-white px-6 py-3 rounded-2xl font-semibold hover:bg-gray-900"
        >
          Nueva sesión
        </button>
      </div>
    );
  }

  if (step === "info") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva sesión</h1>
          <p className="text-gray-500 text-sm">Registra las ventas del mercado</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mercado</label>
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
                    {m.dia_semana === "especial" ? "mercado especial" : m.dia_semana}
                  </span>
                </button>
              ))}

              {/* Formulario nuevo mercado */}
              {nuevoMercado ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Nombre del mercado"
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
                    <option value="">Selecciona una caja...</option>
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
                      {guardandoMercado ? "Guardando..." : "Crear mercado"}
                    </button>
                    <button
                      onClick={() => { setNuevoMercado(false); setNuevoNombre(""); setNuevaCajaId(""); }}
                      className="px-4 py-2 rounded-lg text-sm text-gray-500 bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNuevoMercado(true)}
                  className="text-left px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
                >
                  + Añadir mercado especial
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Trabajador</label>
            <input
              type="text"
              value={trabajador}
              onChange={(e) => setTrabajador(e.target.value)}
              placeholder="Nombre del empleado"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        <button
          onClick={handleIniciar}
          disabled={!mercadoId || !trabajador.trim()}
          className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg disabled:opacity-40 hover:bg-gray-900 transition-colors"
        >
          Registrar ventas →
        </button>
      </div>
    );
  }

  const mercado = mercados.find((m) => m.id === mercadoId);
  const totalVentas = Object.values(ventas).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ventas del día</h1>
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
                      <span className="text-xs font-semibold text-gray-700">Póster</span>
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
                          <span className="text-sm text-gray-900 font-medium">{p.nombre}</span>
                          {p.tiene_a4 ? (
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                min={0}
                                max={invA4?.cantidad || 99}
                                value={ventas[`${p.id}-A4`] || 0}
                                onChange={(e) => setVenta(p.id, "A4", parseInt(e.target.value) || 0)}
                                className="w-16 text-center text-sm text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:border-black"
                              />
                              {invA4 && <span className="text-xs text-gray-600 font-medium">/{invA4.cantidad}</span>}
                            </div>
                          ) : <div />}
                          {p.tiene_a3 ? (
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                min={0}
                                max={invA3?.cantidad || 99}
                                value={ventas[`${p.id}-A3`] || 0}
                                onChange={(e) => setVenta(p.id, "A3", parseInt(e.target.value) || 0)}
                                className="w-16 text-center text-sm text-gray-900 border border-gray-300 rounded-lg py-1 focus:outline-none focus:border-black"
                              />
                              {invA3 && <span className="text-xs text-gray-600 font-medium">/{invA3.cantidad}</span>}
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

          <div className="sticky bottom-20 bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{totalVentas} ventas registradas</p>
              <p className="text-xs text-gray-500">Confirma para actualizar el stock</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || totalVentas === 0}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors"
            >
              {submitting ? "Guardando..." : "Confirmar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
