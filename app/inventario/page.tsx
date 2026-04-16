"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Caja, Serie, Poster, Inventario } from "@/lib/types";
import { SkeletonPage } from "@/app/components/Skeleton";

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

interface PosterConStock extends Poster {
  series?: Serie;
  a4?: { id: string; cantidad: number; out: boolean; sample_falta: boolean };
  a3?: { id: string; cantidad: number; out: boolean; sample_falta: boolean };
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <InventarioInner />
    </Suspense>
  );
}

function InventarioInner() {
  const params = useSearchParams();
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState<string>("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    supabase.from("cajas").select("*").then(({ data }) => {
      if (data && data.length > 0) {
        setCajas(data);
        const paramCaja = params.get("caja");
        const found = data.find((c) => c.nombre.replace(/ /g, '-') === paramCaja || c.id === paramCaja);
        setCajaId(found?.id || data[0].id);
      }
    });
  }, [params]);

  const fetchInventario = useCallback(async () => {
    if (!cajaId) return;
    setLoading(true);
    const [postersRes, invRes, seriesRes] = await Promise.all([
      supabase.from("posters").select("*, series(*)").eq("activo", true).order("nombre"),
      supabase.from("inventario").select("*").eq("caja_id", cajaId),
      supabase.from("series").select("*"),
    ]);

    const inv: Inventario[] = invRes.data || [];
    const seriesData: Serie[] = seriesRes.data || [];
    setSeries(seriesData);

    const postersConStock: PosterConStock[] = (postersRes.data || []).map((p: Poster & { series?: Serie }) => {
      const a4 = inv.find((i) => i.poster_id === p.id && i.talla === "A4");
      const a3 = inv.find((i) => i.poster_id === p.id && i.talla === "A3");
      return {
        ...p,
        a4: a4 ? { id: a4.id, cantidad: a4.cantidad, out: a4.out, sample_falta: a4.sample_falta } : undefined,
        a3: a3 ? { id: a3.id, cantidad: a3.cantidad, out: a3.out, sample_falta: a3.sample_falta } : undefined,
      };
    });
    setPosters(postersConStock);
    setLoading(false);
  }, [cajaId]);

  useEffect(() => {
    fetchInventario();
  }, [fetchInventario]);

  async function upsertInventario(posterId: string, talla: "A4" | "A3", field: string, value: number | boolean) {
    setSaving(`${posterId}-${talla}-${field}`);
    const tallaKey = talla === "A4" ? "a4" : "a3";
    const existing = posters.find((p) => p.id === posterId)?.[tallaKey];

    if (existing?.id) {
      await supabase.from("inventario").update({ [field]: value }).eq("id", existing.id);
    } else {
      const { data } = await supabase.from("inventario").upsert({
        caja_id: cajaId,
        poster_id: posterId,
        talla,
        [field]: value,
      }, { onConflict: "caja_id,poster_id,talla" }).select().single();
      if (data) {
        setPosters((prev) => prev.map((p) => {
          if (p.id !== posterId) return p;
          return { ...p, [tallaKey]: { id: data.id, cantidad: data.cantidad, out: data.out, sample_falta: data.sample_falta } };
        }));
      }
    }

    // Actualiza solo el poster en el estado local sin recargar toda la página
    setPosters((prev) => prev.map((p) => {
      if (p.id !== posterId) return p;
      const current = p[tallaKey] || { id: "", cantidad: 0, out: false, sample_falta: false };
      return { ...p, [tallaKey]: { ...current, [field]: value } };
    }));

    setSaving(null);
  }

  async function guardarCantidad(posterId: string, talla: "A4" | "A3") {
    const key = `${posterId}-${talla}`;
    const cantidad = editando[key];
    if (cantidad === undefined) return;
    await upsertInventario(posterId, talla, "cantidad", cantidad);
    setEditando((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const seriesIds = [...new Set(posters.map((p) => p.serie_id))];
  const seriesConPosters = seriesIds
    .map((sid) => {
      const serie = series.find((s) => s.id === sid);
      const orden = POSTERS_ORDER[serie?.nombre || ""] || [];
      const sp = posters
        .filter((p) => p.serie_id === sid)
        .sort((a, b) => {
          const ia = orden.indexOf(a.nombre);
          const ib = orden.indexOf(b.nombre);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
      return { serie, posters: sp };
    })
    .sort((a, b) => {
      const ia = SERIES_ORDER.indexOf(a.serie?.nombre || "");
      const ib = SERIES_ORDER.indexOf(b.serie?.nombre || "");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const caja = cajas.find((c) => c.id === cajaId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-gray-500 text-sm">Stock por caja y póster</p>
      </div>

      {/* Selector de caja */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cajas.map((c) => (
          <button
            key={c.id}
            onClick={() => setCajaId(c.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              cajaId === c.id ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {caja && (
        <p className="text-xs text-gray-500 -mt-2">{caja.descripcion}</p>
      )}

      {loading ? (
        <SkeletonPage />
      ) : (
        <div className="space-y-6">
          {seriesConPosters.map(({ serie, posters: sp }) => (
            <div key={serie?.id || "sin-serie"}>
              <div
                className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg mb-2 inline-block"
                style={{ backgroundColor: serie?.color + "22", color: serie?.color }}
              >
                {serie?.nombre}
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <span>Póster</span>
                  <span className="w-24 text-center">A4</span>
                  <span className="w-24 text-center">A3</span>
                </div>
                {sp.map((p, idx) => {
                  const stockBajoA4 = p.tiene_a4 && !p.a4?.out && (p.a4?.cantidad ?? 0) > 0 && (p.a4?.cantidad ?? 0) < 3;
                  const stockBajoA3 = p.tiene_a3 && !p.a3?.out && (p.a3?.cantidad ?? 0) > 0 && (p.a3?.cantidad ?? 0) < 3;
                  const stockBajo = stockBajoA4 || stockBajoA3;
                  return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 items-center ${idx < sp.length - 1 ? "border-b border-gray-100" : ""} ${stockBajo ? "bg-yellow-50" : ""}`}
                  >
                    <span className={`text-sm font-medium ${stockBajo ? "text-yellow-700" : "text-gray-800"}`}>
                      {stockBajo && <span className="mr-1">⚠️</span>}{p.nombre}
                    </span>
                    {/* A4 */}
                    {p.tiene_a4 ? (
                      <TallaCell
                        posterId={p.id}
                        talla="A4"
                        stock={p.a4}
                        saving={saving}
                        editando={editando}
                        setEditando={setEditando}
                        guardarCantidad={guardarCantidad}
                        upsertInventario={upsertInventario}
                      />
                    ) : <div className="w-24" />}
                    {/* A3 */}
                    {p.tiene_a3 ? (
                      <TallaCell
                        posterId={p.id}
                        talla="A3"
                        stock={p.a3}
                        saving={saving}
                        editando={editando}
                        setEditando={setEditando}
                        guardarCantidad={guardarCantidad}
                        upsertInventario={upsertInventario}
                      />
                    ) : <div className="w-24" />}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TallaCellProps {
  posterId: string;
  talla: "A4" | "A3";
  stock?: { id: string; cantidad: number; out: boolean; sample_falta: boolean };
  saving: string | null;
  editando: { [key: string]: number };
  setEditando: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  guardarCantidad: (posterId: string, talla: "A4" | "A3") => Promise<void>;
  upsertInventario: (posterId: string, talla: "A4" | "A3", field: string, value: number | boolean) => Promise<void>;
}

function TallaCell({ posterId, talla, stock, saving, editando, setEditando, guardarCantidad, upsertInventario }: TallaCellProps) {
  const key = `${posterId}-${talla}`;
  const isSaving = saving?.startsWith(key);
  const cantidad = editando[key] !== undefined ? editando[key] : (stock?.cantidad ?? 0);

  return (
    <div className="w-24 flex flex-col items-center gap-1">
      {/* Cantidad */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={cantidad}
          onChange={(e) => setEditando((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
          onBlur={() => guardarCantidad(posterId, talla)}
          className="w-12 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-gray-400"
        />
        {isSaving && <span className="w-3 h-3 rounded-full bg-gray-300 animate-pulse inline-block" />}
      </div>
      {/* Toggles OUT y SAMPLE */}
      <div className="flex gap-1">
        <button
          onClick={() => upsertInventario(posterId, talla, "out", !stock?.out)}
          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
            stock?.out ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"
          }`}
          title="Sold Out"
        >
          OUT
        </button>
        <button
          onClick={() => upsertInventario(posterId, talla, "sample_falta", !stock?.sample_falta)}
          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
            stock?.sample_falta ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-400"
          }`}
          title="Falta sample"
        >
          SMP
        </button>
      </div>
    </div>
  );
}
