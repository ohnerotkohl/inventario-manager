"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Poster, Serie, Inventario } from "@/lib/types";
import { SkeletonPage } from "@/app/components/Skeleton";

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

interface PosterConSeries extends Poster {
  series?: Serie;
}

export default function EditarSesionPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <EditarSesionInner />
    </Suspense>
  );
}

function EditarSesionInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sesionId = params.get("id") || "";

  const [sesion, setSesion] = useState<{ mercado: string; fecha: string; trabajador: string; cajaId: string } | null>(null);
  const [posters, setPosters] = useState<PosterConSeries[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [inventario, setInventario] = useState<Inventario[]>([]);
  const [ventasOriginales, setVentasOriginales] = useState<{ [key: string]: number }>({});
  const [ventas, setVentas] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (sesionId) loadData();
  }, [sesionId]);

  async function loadData() {
    type SesionRow = { fecha: string; trabajador: string; mercados: { nombre: string; caja_id: string } | null };
    const { data: sesionData } = await supabase
      .from("sesiones")
      .select("fecha, trabajador, mercados(nombre, caja_id)")
      .eq("id", sesionId)
      .single() as { data: SesionRow | null };

    if (!sesionData || !sesionData.mercados) return;

    setSesion({
      mercado: sesionData.mercados.nombre,
      fecha: sesionData.fecha,
      trabajador: sesionData.trabajador,
      cajaId: sesionData.mercados.caja_id,
    });

    const cajaId = sesionData.mercados.caja_id;

    const [postersRes, invRes, seriesRes, ventasRes] = await Promise.all([
      supabase.from("posters").select("*, series(*)").eq("activo", true).order("nombre"),
      supabase.from("inventario").select("*").eq("caja_id", cajaId),
      supabase.from("series").select("*"),
      supabase.from("ventas").select("poster_id, talla, cantidad").eq("sesion_id", sesionId),
    ]);

    setPosters(postersRes.data || []);
    setInventario(invRes.data || []);
    setSeries(seriesRes.data || []);

    const ventasMap: { [key: string]: number } = {};
    for (const v of (ventasRes.data || [])) {
      const key = `${v.poster_id}-${v.talla}`;
      ventasMap[key] = (ventasMap[key] || 0) + v.cantidad;
    }
    setVentasOriginales({ ...ventasMap });
    setVentas({ ...ventasMap });
    setLoading(false);
  }

  async function handleGuardar() {
    setSubmitting(true);

    const allKeys = new Set([...Object.keys(ventasOriginales), ...Object.keys(ventas)]);
    const inventarioUpdates: Promise<unknown>[] = [];

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
        );
      }
    }

    // Reemplazar todas las ventas de esta sesión
    const nuevasVentas = Object.entries(ventas)
      .filter(([, cant]) => cant > 0)
      .map(([key, cantidad]) => ({
        sesion_id: sesionId,
        poster_id: key.slice(0, -3),
        talla: key.slice(-2),
        cantidad,
      }));

    await Promise.all([
      supabase.from("ventas").delete().eq("sesion_id", sesionId),
      ...inventarioUpdates,
    ]);

    if (nuevasVentas.length > 0) {
      await supabase.from("ventas").insert(nuevasVentas);
    }

    router.push("/estadisticas");
  }

  async function handleEliminarSesion() {
    setSubmitting(true);

    // Devolver stock al inventario
    const inventarioUpdates: Promise<unknown>[] = [];
    for (const [key, cantidad] of Object.entries(ventasOriginales)) {
      if (cantidad <= 0) continue;
      const talla = key.slice(-2) as "A4" | "A3";
      const posterId = key.slice(0, -3);
      const invItem = inventario.find((i) => i.poster_id === posterId && i.talla === talla);
      if (invItem) {
        inventarioUpdates.push(
          supabase.from("inventario")
            .update({ cantidad: invItem.cantidad + cantidad, out: false })
            .eq("id", invItem.id)
        );
      }
    }

    await Promise.all([
      supabase.from("ventas").delete().eq("sesion_id", sesionId),
      ...inventarioUpdates,
    ]);
    await supabase.from("sesiones").delete().eq("id", sesionId);

    router.push("/estadisticas");
  }

  const seriesIds = [...new Set(posters.map((p) => p.serie_id))].sort((a, b) => {
    const sa = series.find((s) => s.id === a);
    const sb = series.find((s) => s.id === b);
    const ia = SERIES_ORDER.indexOf(sa?.nombre || "");
    const ib = SERIES_ORDER.indexOf(sb?.nombre || "");
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const totalVentas = Object.values(ventas).reduce((a, b) => a + b, 0);
  const hayCambios = JSON.stringify(ventas) !== JSON.stringify(ventasOriginales);

  if (!sesionId) return <div className="text-center py-20 text-gray-400">Sesión no encontrada</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-2xl">‹</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar sesión</h1>
          {sesion && (
            <p className="text-gray-500 text-sm">
              {sesion.mercado} · {new Date(sesion.fecha + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "long", year: "numeric" })} · {sesion.trabajador}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonPage />
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
                      <span className="text-xs font-semibold text-gray-500">Póster</span>
                      <span className="text-xs font-semibold text-gray-500 text-center">A4</span>
                      <span className="text-xs font-semibold text-gray-500 text-center">A3</span>
                    </div>
                    {sp.map((p, idx) => {
                      const invA4 = inventario.find((i) => i.poster_id === p.id && i.talla === "A4");
                      const invA3 = inventario.find((i) => i.poster_id === p.id && i.talla === "A3");
                      return (
                        <div
                          key={p.id}
                          className={`grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-3 items-center ${idx < sp.length - 1 ? "border-b border-gray-100" : ""}`}
                        >
                          <span className="text-sm text-gray-800">{p.nombre}</span>
                          {p.tiene_a4 ? (
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                min={0}
                                value={ventas[`${p.id}-A4`] || 0}
                                onChange={(e) => setVentas((prev) => ({ ...prev, [`${p.id}-A4`]: parseInt(e.target.value) || 0 }))}
                                className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-black"
                              />
                              {invA4 && <span className="text-xs text-gray-400">stock: {invA4.cantidad}</span>}
                            </div>
                          ) : <div />}
                          {p.tiene_a3 ? (
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                min={0}
                                value={ventas[`${p.id}-A3`] || 0}
                                onChange={(e) => setVentas((prev) => ({ ...prev, [`${p.id}-A3`]: parseInt(e.target.value) || 0 }))}
                                className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-black"
                              />
                              {invA3 && <span className="text-xs text-gray-400">stock: {invA3.cantidad}</span>}
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

          {/* Botones */}
          <div className="sticky bottom-20 bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900">{totalVentas} ventas en total</p>
              <p className="text-xs text-gray-500">{hayCambios ? "Hay cambios sin guardar" : "Sin cambios"}</p>
            </div>
            <button
              onClick={handleGuardar}
              disabled={submitting || !hayCambios}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>

          {/* Eliminar sesión */}
          <div className="border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">⚠️ Zona peligrosa</p>
            <p className="text-xs text-gray-500 mb-3">Eliminar esta sesión devuelve todo el stock al inventario.</p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-600 font-medium underline"
              >
                Eliminar sesión
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleEliminarSesion}
                  disabled={submitting}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                  Sí, eliminar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
