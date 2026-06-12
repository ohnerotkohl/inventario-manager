"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Caja, Serie, Poster, Inventario } from "@/lib/types";
import { SkeletonPage } from "@/app/components/Skeleton";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";

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
  const { user } = useAuth();
  const { t, tr } = useLang();
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState<string>("");

  // Permiso por caja: admin = todas; empleado con puede_inventario =
  // solo sus cajas_permitidas (NULL = ninguna); resto = solo lectura
  const puedeEditarCaja = useCallback((id: string) => {
    if (!user) return false;
    if (user.rol === "admin") return true;
    if (!user.puede_inventario) return false;
    return (user.cajas_permitidas ?? []).includes(id);
  }, [user]);
  const readOnly = !puedeEditarCaja(cajaId);
  const [series, setSeries] = useState<Serie[]>([]);
  const [posters, setPosters] = useState<PosterConStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ [key: string]: number }>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [guardandoTodo, setGuardandoTodo] = useState(false);
  const [saveErrInv, setSaveErrInv] = useState("");

  function toggleSerie(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  useEffect(() => {
    supabase.from("cajas").select("*").then(({ data }) => {
      if (data && data.length > 0) {
        setCajas(data);
        // Solo preseleccionar si viene por URL; si no, mostrar el panel de selección
        const paramCaja = params.get("caja");
        const found = data.find((c) => c.nombre.replace(/ /g, '-') === paramCaja || c.id === paramCaja);
        if (found) setCajaId(found.id);
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

  // Guard: warn before navigating away with unsaved stock edits
  useEffect(() => {
    if (Object.keys(editando).length === 0) return;

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
  }, [editando, t.leaveConfirm]);

  async function upsertInventario(posterId: string, talla: "A4" | "A3", field: string, value: number | boolean) {
    setSaving(`${posterId}-${talla}-${field}`);
    const tallaKey = talla === "A4" ? "a4" : "a3";
    const existing = posters.find((p) => p.id === posterId)?.[tallaKey];

    if (existing?.id) {
      const { error } = await supabase.from("inventario").update({ [field]: value }).eq("id", existing.id);
      if (error) {
        setSaving(null);
        throw new Error(`${posterId} ${talla}: ${error.message}`);
      }
    } else {
      const { data, error } = await supabase.from("inventario").upsert({
        caja_id: cajaId,
        poster_id: posterId,
        talla,
        [field]: value,
      }, { onConflict: "caja_id,poster_id,talla" }).select().single();
      if (error) {
        setSaving(null);
        throw new Error(`${posterId} ${talla}: ${error.message}`);
      }
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
    try {
      setSaveErrInv("");
      await upsertInventario(posterId, talla, "cantidad", cantidad);
      const tallaKey = talla === "A4" ? "a4" : "a3";
      const current = posters.find((p) => p.id === posterId)?.[tallaKey];
      if (cantidad === 0) {
        await upsertInventario(posterId, talla, "out", true);
      } else if (current?.out) {
        await upsertInventario(posterId, talla, "out", false);
      }
      setEditando((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      setSaveErrInv(err instanceof Error ? err.message : t.purchasesSaveError);
      // Keep editando so the value stays amber and user can retry
    }
  }

  async function guardarTodo() {
    setGuardandoTodo(true);
    setSaveErrInv("");
    const pendientes = Object.keys(editando);
    try {
      for (const key of pendientes) {
        const talla = key.slice(-2) as "A4" | "A3";
        const posterId = key.slice(0, -3);
        await guardarCantidad(posterId, talla);
      }
    } catch (err) {
      setSaveErrInv(err instanceof Error ? err.message : t.purchasesSaveError);
    }
    setGuardandoTodo(false);
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

  // Paso 1: seleccionar el mercado/caja antes de mostrar el stock
  if (!cajaId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.inventory}</h1>
          <p className="text-gray-500 text-sm">{t.selectBoxFirst}</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {cajas.map((c) => {
            const editable = puedeEditarCaja(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setCajaId(c.id)}
                className="text-left bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 hover:border-black transition-colors flex items-center justify-between"
              >
                <span className="font-semibold text-gray-900">{c.nombre}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${editable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {editable ? t.canEditBadge : t.readOnlyBadge}
                </span>
              </button>
            );
          })}
          {cajas.length === 0 && <SkeletonPage />}
          {/* Restock vive aquí dentro para liberar espacio en el menú inferior */}
          {user?.rol === "admin" && cajas.length > 0 && (
            <Link
              href="/restock"
              className="flex items-center justify-center gap-2 text-sm font-semibold bg-black text-white rounded-2xl px-5 py-4 hover:bg-gray-900 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              {t.restockTitle}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.inventory}</h1>
        <p className="text-gray-500 text-sm">{t.inventorySubtitle}</p>
      </div>
      {readOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-sm text-yellow-700">
          {t.readOnlyMode}
        </div>
      )}

      {/* Caja seleccionada + botón cambiar */}
      <div className="flex items-center justify-between bg-black text-white rounded-2xl px-4 py-3">
        <span className="font-semibold">{caja?.nombre}</span>
        <button
          onClick={() => {
            if (Object.keys(editando).length > 0 && !window.confirm(t.leaveConfirm)) return;
            setEditando({});
            setCajaId("");
          }}
          className="text-xs underline text-gray-300 hover:text-white transition-colors"
        >
          {t.changeBox}
        </button>
      </div>

      {/* Floating save bar — fixed above nav, doesn't affect page layout */}
      {!readOnly && Object.keys(editando).length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 pointer-events-none">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 flex items-center justify-between shadow-lg pointer-events-auto">
            <div>
              <p className="font-semibold text-amber-900 text-sm">{tr("unsavedChanges", { n: Object.keys(editando).length })}</p>
              {saveErrInv
                ? <p className="text-xs text-red-600">{saveErrInv}</p>
                : <p className="text-xs text-amber-600">{t.tapToSave}</p>
              }
            </div>
            <button
              onClick={guardarTodo}
              disabled={guardandoTodo}
              className="bg-black text-white px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-gray-900 transition-colors"
            >
              {guardandoTodo ? t.saving : t.save}
            </button>
          </div>
        </div>
      )}

      {!loading && seriesConPosters.length > 0 && (
        <div className="flex justify-end">
          {(() => {
            const allIds = seriesConPosters.map(({ serie }) => serie?.id || "sin-serie");
            const allCollapsed = allIds.every(id => collapsed.has(id));
            return (
              <button
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allIds))}
                className="text-xs text-gray-400 hover:text-gray-700 underline transition-colors"
              >
                {allCollapsed ? t.expandAll : t.collapseAll}
              </button>
            );
          })()}
        </div>
      )}

      {loading ? (
        <SkeletonPage />
      ) : (
        <div className="space-y-6">
          {seriesConPosters.map(({ serie, posters: sp }) => {
            const isCollapsed = collapsed.has(serie?.id || "sin-serie");
            return (
            <div key={serie?.id || "sin-serie"}>
              <button
                onClick={() => toggleSerie(serie?.id || "sin-serie")}
                className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: serie?.color + "22", color: serie?.color }}
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
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  <span>{t.poster}</span>
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
                      {stockBajo && (
                      <svg className="inline-block mr-1 mb-0.5 text-yellow-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    )}{p.nombre}
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
                        readOnly={readOnly}
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
                        readOnly={readOnly}
                      />
                    ) : <div className="w-24" />}
                  </div>
                  );
                })}
              </div>}
            </div>
            );
          })}
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
  readOnly?: boolean;
}

function TallaCell({ posterId, talla, stock, saving, editando, setEditando, guardarCantidad, upsertInventario, readOnly }: TallaCellProps) {
  const { t } = useLang();
  const key = `${posterId}-${talla}`;
  const isSaving = saving?.startsWith(key);
  const cantidad = editando[key] !== undefined ? editando[key] : (stock?.cantidad ?? 0);

  return (
    <div className="w-24 flex flex-col items-center gap-1">
      {/* Cantidad */}
      <div className="flex items-center gap-1">
        {readOnly ? (
          <span className="w-12 text-center text-sm font-semibold text-gray-900">{cantidad}</span>
        ) : (
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            value={editando[key] !== undefined ? editando[key] : (stock?.cantidad ?? 0)}
            onChange={(e) => setEditando((prev) => ({ ...prev, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
            onFocus={(e) => e.target.select()}
            onBlur={() => guardarCantidad(posterId, talla)}
            className={`w-12 text-center text-sm font-semibold border rounded-lg py-1 focus:outline-none transition-colors ${
              editando[key] !== undefined
                ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-500"
                : "border-gray-200 text-gray-900 focus:border-gray-400"
            }`}
          />
        )}
        {isSaving && <span className="w-3 h-3 rounded-full bg-gray-300 animate-pulse inline-block" />}
      </div>
      {/* Toggles OUT y SAMPLE */}
      <div className="flex gap-1">
        <button
          onClick={() => !readOnly && upsertInventario(posterId, talla, "out", !stock?.out)}
          disabled={readOnly}
          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
            stock?.out ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"
          } ${readOnly ? "cursor-default" : ""}`}
          title={t.soldOutTitle}
        >
          OUT
        </button>
        <button
          onClick={() => !readOnly && upsertInventario(posterId, talla, "sample_falta", !stock?.sample_falta)}
          disabled={readOnly}
          className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
            stock?.sample_falta ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-400"
          } ${readOnly ? "cursor-default" : ""}`}
          title={t.missingSampleTitle}
        >
          SMP
        </button>
      </div>
    </div>
  );
}
