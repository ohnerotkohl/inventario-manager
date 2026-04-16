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

export default function RestockPage() {
  const [step, setStep] = useState<Step>("seleccion");
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConStock[]>([]);
  const [cantidades, setCantidades] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase.from("cajas").select("*").then(({ data }) => {
      setCajas(data || []);
    });
  }, []);

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

    const updates: PromiseLike<unknown>[] = [];

    for (const [key, cantidad] of Object.entries(cantidades)) {
      if (cantidad <= 0) continue;
      const talla = key.slice(-2) as "A4" | "A3";
      const posterId = key.slice(0, -3);
      const poster = posters.find((p) => p.id === posterId);
      if (!poster) continue;

      const invId = talla === "A4" ? poster.a4InvId : poster.a3InvId;
      const stockActual = talla === "A4" ? poster.a4Stock : poster.a3Stock;
      const nuevoStock = stockActual + cantidad;

      if (invId) {
        updates.push(
          supabase.from("inventario")
            .update({ cantidad: nuevoStock, out: false })
            .eq("id", invId)
        );
      } else {
        updates.push(
          supabase.from("inventario").upsert({
            caja_id: cajaId,
            poster_id: posterId,
            talla,
            cantidad: nuevoStock,
            out: false,
          }, { onConflict: "caja_id,poster_id,talla" })
        );
      }
    }

    await Promise.all(updates);
    setGuardando(false);
    setStep("confirmado");
  }

  const totalUnidades = Object.values(cantidades).reduce((a, b) => a + b, 0);
  const totalPosters = Object.values(cantidades).filter((v) => v > 0).length;
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
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-bold text-gray-900">¡Restock completado!</h2>
        <p className="text-gray-500">
          Se añadieron <strong>{totalUnidades} unidades</strong> al stock de <strong>{caja?.nombre}</strong>.
        </p>
        <button
          onClick={() => { setStep("seleccion"); setCantidades({}); setCajaId(""); }}
          className="mt-4 bg-black text-white px-6 py-3 rounded-2xl font-semibold hover:bg-gray-900"
        >
          Hacer otro restock
        </button>
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
          <p className="font-bold text-gray-900">{totalUnidades} unidades · {totalPosters} pósters</p>
          <p className="text-xs text-gray-500">Se suman al stock actual de {caja?.nombre}</p>
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
