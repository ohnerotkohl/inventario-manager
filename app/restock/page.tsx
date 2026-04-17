"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
}

type Step = "seleccion" | "restock" | "confirmado";
type TabPrincipal = "restock" | "historial";

interface RestockHistorial {
  id: string;
  fecha: string;
  caja: string;
  totalA4: number;
  totalA3: number;
  total: number;
  lineas: { nombre: string; talla: string; cantidad: number }[];
}

export default function RestockPage() {
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("restock");
  const [step, setStep] = useState<Step>("seleccion");
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConStock[]>([]);
  const [cantidades, setCantidades] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<RestockHistorial[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  useEffect(() => {
    supabase.from("cajas").select("*").then(({ data }) => {
      setCajas(data || []);
    });
  }, []);

  useEffect(() => {
    if (tabPrincipal === "historial") fetchHistorial();
  }, [tabPrincipal]);

  async function fetchHistorial() {
    setLoadingHistorial(true);
    const { data } = await supabase
      .from("restocks")
      .select("id, fecha, caja_id, cajas(nombre), restock_lineas(cantidad, talla, posters(nombre))")
      .order("fecha", { ascending: false });

    type RestockRow = {
      id: string;
      fecha: string;
      caja_id: string;
      cajas: { nombre: string } | null;
      restock_lineas: { cantidad: number; talla: string; posters: { nombre: string } | null }[];
    };

    const rows = (data || []) as unknown as RestockRow[];
    setHistorial(rows.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      caja: r.cajas?.nombre || "—",
      totalA4: r.restock_lineas.filter((l) => l.talla === "A4").reduce((a, l) => a + l.cantidad, 0),
      totalA3: r.restock_lineas.filter((l) => l.talla === "A3").reduce((a, l) => a + l.cantidad, 0),
      total: r.restock_lineas.reduce((a, l) => a + l.cantidad, 0),
      lineas: r.restock_lineas.map((l) => ({ nombre: l.posters?.nombre || "—", talla: l.talla, cantidad: l.cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
    })));
    setLoadingHistorial(false);
  }

  async function cargarPosters() {
    if (!cajaId) return;
    setLoading(true);

    const [postersRes, invRes, seriesRes] = await Promise.all([
      supabase.from("posters").select("*, series(*)").eq("activo", true),
      supabase.from("inventario").select("*").eq("caja_id", cajaId),
      supabase.from("series").select("*"),
    ]);

    const inv: Inventario[] = invRes.data || [];
    setSeries(seriesRes.data || []);

    const postersConStock: PosterConStock[] = (postersRes.data || []).map((p: Poster & { series?: Serie }) => {
      const a4 = inv.find((i) => i.poster_id === p.id && i.talla === "A4");
      const a3 = inv.find((i) => i.poster_id === p.id && i.talla === "A3");
      return {
        ...p,
        a4Stock: a4?.cantidad || 0,
        a3Stock: a3?.cantidad || 0,
        a4InvId: a4?.id,
        a3InvId: a3?.id,
      };
    });

    setPosters(postersConStock);
    setCantidades({});
    setLoading(false);
    setStep("restock");
  }

  async function confirmarRestock() {
    setGuardando(true);
    const hoy = new Date().toISOString().split("T")[0];

    // Buscar restock existente hoy para esta caja
    const { data: restockExistente } = await supabase
      .from("restocks")
      .select("id")
      .eq("caja_id", cajaId)
      .eq("fecha", hoy)
      .maybeSingle();

    let restockId: string;
    if (restockExistente) {
      restockId = restockExistente.id;
    } else {
      const { data: nuevoRestock } = await supabase
        .from("restocks")
        .insert({ caja_id: cajaId, fecha: hoy })
        .select()
        .single();
      restockId = nuevoRestock?.id;
    }

    const updates: PromiseLike<unknown>[] = [];
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

      if (invId) {
        updates.push(supabase.from("inventario").update({ cantidad: nuevoStock, out: false }).eq("id", invId));
      } else {
        updates.push(supabase.from("inventario").upsert({
          caja_id: cajaId, poster_id: posterId, talla, cantidad: nuevoStock, out: false,
        }, { onConflict: "caja_id,poster_id,talla" }));
      }
    }

    await Promise.all([
      ...updates,
      lineas.length > 0 ? supabase.from("restock_lineas").insert(lineas) : Promise.resolve(),
    ]);

    setGuardando(false);
    setStep("confirmado");
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
        <div className="text-5xl">✅</div>
        <h2 className="text-2xl font-bold text-gray-900">¡Restock completado!</h2>
        <p className="text-gray-500">
          Se añadieron <strong>{totalUnidades} unidades</strong> ({totalA4 > 0 ? `A4: ${totalA4}` : ""}{totalA4 > 0 && totalA3 > 0 ? " · " : ""}{totalA3 > 0 ? `A3: ${totalA3}` : ""}) al stock de <strong>{caja?.nombre}</strong>.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => { setStep("seleccion"); setCantidades({}); setCajaId(""); }}
            className="bg-black text-white px-6 py-3 rounded-2xl font-semibold hover:bg-gray-900"
          >
            Hacer otro restock
          </button>
          <button
            onClick={() => { setStep("seleccion"); setCantidades({}); setCajaId(""); setTabPrincipal("historial"); }}
            className="border-2 border-black text-black px-6 py-3 rounded-2xl font-semibold hover:bg-gray-50"
          >
            Ver historial
          </button>
        </div>
      </div>
    );
  }

  if (step === "seleccion") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restock</h1>
          <p className="text-gray-500 text-sm">Añade nuevas unidades impresas al stock</p>
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
            Nuevo restock
          </button>
          <button
            onClick={() => setTabPrincipal("historial")}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${tabPrincipal === "historial" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Historial
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
                <p className="text-2xl mb-2">🖨️</p>
                <p>No hay historial de restock aún</p>
              </div>
            ) : historial.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setHistorialAbierto(historialAbierto === r.id ? null : r.id)}
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{r.caja}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(r.fecha + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long" })}
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
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5">
                      <span className="text-xs font-semibold text-gray-400">Póster</span>
                      <span className="text-xs font-semibold text-gray-400">Talla</span>
                      <span className="text-xs font-semibold text-gray-400 text-right">Uds.</span>
                      {r.lineas.map((l, i) => (
                        <>
                          <span key={`n-${i}`} className="text-sm text-gray-800 truncate">{l.nombre}</span>
                          <span key={`t-${i}`} className="text-sm text-gray-500">{l.talla}</span>
                          <span key={`c-${i}`} className="text-sm font-semibold text-gray-900 text-right">{l.cantidad}</span>
                        </>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tabPrincipal === "restock" && <>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-gray-700">¿Qué caja vas a reponer?</p>
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
          disabled={!cajaId || loading}
          className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-lg disabled:opacity-40 hover:bg-gray-900 transition-colors"
        >
          {loading ? "Cargando..." : "Continuar →"}
        </button>
        </>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restock — {caja?.nombre}</h1>
        <p className="text-gray-500 text-sm">Escribe cuántas unidades nuevas añades. El stock actual se muestra en gris.</p>
      </div>

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
                <div className="grid grid-cols-[1fr_90px_90px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <span>Póster</span>
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
                          min={0}
                          placeholder="0"
                          value={cantidades[`${p.id}-A4`] || ""}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [`${p.id}-A4`]: parseInt(e.target.value) || 0 }))}
                          className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-black"
                        />
                        <span className="text-xs text-gray-400">stock: {p.a4Stock}</span>
                      </div>
                    ) : <div />}
                    {p.tiene_a3 ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={cantidades[`${p.id}-A3`] || ""}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [`${p.id}-A3`]: parseInt(e.target.value) || 0 }))}
                          className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-black"
                        />
                        <span className="text-xs text-gray-400">stock: {p.a3Stock}</span>
                      </div>
                    ) : <div />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón confirmar */}
      <div className="sticky bottom-20 bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">{totalUnidades} unidades de {totalPosters} diseños</p>
          <p className="text-xs text-gray-500">{totalA4 > 0 ? `A4: ${totalA4}` : ""}{totalA4 > 0 && totalA3 > 0 ? " · " : ""}{totalA3 > 0 ? `A3: ${totalA3}` : ""} · {caja?.nombre}</p>
        </div>
        <button
          onClick={confirmarRestock}
          disabled={guardando || totalUnidades === 0}
          className="bg-black text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors"
        >
          {guardando ? "Guardando..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
