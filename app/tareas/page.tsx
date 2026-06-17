"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";

type Tab = "activas" | "pendientes" | "completadas" | "coles";
type Frecuencia = "diaria" | "semanal" | "mensual" | "puntual";
type Dificultad = "simple" | "media" | "compleja";

interface UsuarioMin { id: string; nombre: string; rol: string }

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  asignada_a: string | null;
  frecuencia: Frecuencia;
  proxima_fecha: string | null;
  dificultad: Dificultad;
  puntos_coles: number;
  estado: "pendiente" | "atrasada" | "completada" | "urgente";
  rotacion: boolean;
  orden_rotacion: string[];
  rotacion_idx: number;
  created_at: string;
  updated_at: string;
}

interface ColesMove {
  id: string;
  usuario_nombre: string;
  coles_delta: number;
  motivo: string;
  created_at: string;
}

const COLES_MES = 100;

const TrofeoIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 mr-1 text-purple-600">
    <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
  </svg>
);

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TareasPage() {
  const { t, tr } = useLang();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("activas");
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioMin[]>([]);
  const [coles, setColes] = useState<ColesMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [completando, setCompletando] = useState<string | null>(null);
  const [quien, setQuien] = useState("");
  const [aviso, setAviso] = useState("");

  // Formulario nueva tarea
  const [fNombre, setFNombre] = useState("");
  const [fDescripcion, setFDescripcion] = useState("");
  const [fCategoria, setFCategoria] = useState("Otra");
  const [fAsignada, setFAsignada] = useState("");
  const [fFrecuencia, setFFrecuencia] = useState<Frecuencia>("puntual");
  const [fFecha, setFFecha] = useState("");
  const [fDificultad, setFDificultad] = useState<Dificultad>("media");
  const [fColes, setFColes] = useState(2);
  const [fRotacion, setFRotacion] = useState(false);
  const [fEmpieza, setFEmpieza] = useState("");
  const [fCiclos, setFCiclos] = useState(2);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    fetchData();
  }, [user]);

  async function fetchData() {
    const [tRes, uRes, cRes] = await Promise.all([
      supabase.from("tareas").select("*").order("created_at", { ascending: false }),
      supabase.from("usuarios").select("id, nombre, rol").eq("activo", true),
      supabase.from("coles_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setTareas((tRes.data as Tarea[]) || []);
    setUsuarios((uRes.data as UsuarioMin[]) || []);
    setColes((cRes.data as ColesMove[]) || []);
    setLoading(false);
  }

  if (loading) return <SkeletonPage />;
  if (user?.rol === "empleado") return null;

  const admins = usuarios.filter((u) => u.rol === "admin");
  const nombreDe = (id: string | null) => usuarios.find((u) => u.id === id)?.nombre || null;

  // Activas = recurrentes (mantenimiento que siempre corre); Pendientes = puntuales por hacer
  const activas = tareas.filter((tarea) => tarea.frecuencia !== "puntual" && tarea.estado !== "completada");
  const pendientes = tareas.filter((tarea) => tarea.frecuencia === "puntual" && tarea.estado !== "completada");
  const completadas = tareas.filter((tarea) => tarea.estado === "completada");

  function estaAtrasada(tarea: Tarea): boolean {
    return !!tarea.proxima_fecha && tarea.proxima_fecha < hoy() && tarea.estado !== "completada";
  }

  function setDificultad(d: Dificultad) {
    setFDificultad(d);
    setFColes(d === "simple" ? 1 : d === "media" ? 2 : 3);
  }

  async function crearTarea() {
    if (!fNombre.trim() || creando) return;
    setCreando(true);
    // Rotación: lista con turnos repetidos, ej. [A,A,B,B] = 2 turnos cada uno
    const rotacionActiva = fRotacion && fFrecuencia !== "puntual" && admins.length > 1;
    let orden: string[] = [];
    if (rotacionActiva) {
      const primero = fEmpieza || admins[0].id;
      const resto = admins.filter((a) => a.id !== primero).map((a) => a.id);
      orden = [primero, ...resto].flatMap((id) => Array(Math.max(1, fCiclos)).fill(id));
    }
    const { error } = await supabase.from("tareas").insert({
      nombre: fNombre.trim(),
      descripcion: fDescripcion.trim() || null,
      categoria: fCategoria,
      asignada_a: rotacionActiva ? orden[0] : (fAsignada || null),
      frecuencia: fFrecuencia,
      proxima_fecha: fFecha || null,
      dificultad: fDificultad,
      puntos_coles: fColes,
      estado: "pendiente",
      rotacion: rotacionActiva,
      orden_rotacion: orden,
      rotacion_idx: 0,
      creada_por: user?.id || null,
    });
    setCreando(false);
    if (error) { alert(t.saveError); return; }
    setFNombre(""); setFDescripcion(""); setFCategoria("Otra"); setFAsignada("");
    setFFrecuencia("puntual"); setFFecha(""); setDificultad("media");
    setFRotacion(false); setFEmpieza(""); setFCiclos(2);
    setFormAbierto(false);
    fetchData();
  }

  function avanzarFecha(fecha: string, frecuencia: Frecuencia): string {
    const d = new Date(fecha + "T12:00:00");
    if (frecuencia === "diaria") d.setDate(d.getDate() + 1);
    if (frecuencia === "semanal") d.setDate(d.getDate() + 7);
    if (frecuencia === "mensual") d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function completarTarea(tarea: Tarea, usuarioId: string) {
    const quien = usuarios.find((u) => u.id === usuarioId);
    if (!quien) return;
    let mensajeExtra = "";
    // Las recurrentes no se cierran: avanzan a la siguiente fecha (y rotan el turno)
    if (tarea.frecuencia !== "puntual") {
      let nuevaAsignada = tarea.asignada_a;
      let nuevoIdx = tarea.rotacion_idx;
      if (tarea.rotacion && (tarea.orden_rotacion || []).length > 1) {
        nuevoIdx = (tarea.rotacion_idx + 1) % tarea.orden_rotacion.length;
        nuevaAsignada = tarea.orden_rotacion[nuevoIdx];
        if (nuevaAsignada !== tarea.asignada_a) {
          mensajeExtra = ` → ${tr("rotationNextUp", { name: nombreDe(nuevaAsignada) || "" })}`;
        }
      }
      await supabase.from("tareas").update({
        proxima_fecha: tarea.proxima_fecha ? avanzarFecha(tarea.proxima_fecha, tarea.frecuencia) : null,
        estado: "pendiente",
        asignada_a: nuevaAsignada,
        rotacion_idx: nuevoIdx,
      }).eq("id", tarea.id);
    } else {
      await supabase.from("tareas").update({ estado: "completada" }).eq("id", tarea.id);
    }
    await supabase.from("coles_log").insert({
      usuario_id: quien.id,
      usuario_nombre: quien.nombre,
      coles_delta: -tarea.puntos_coles,
      motivo: `Completó "${tarea.nombre}"`,
      tarea_id: tarea.id,
    });
    setCompletando(null);
    setAviso(tr("taskCompletedMsg", { name: tarea.nombre }) + mensajeExtra);
    setTimeout(() => setAviso(""), 3500);
    fetchData();
  }

  async function eliminarTarea(tarea: Tarea) {
    if (!confirm(tr("deleteTaskConfirm", { name: tarea.nombre }))) return;
    await supabase.from("tareas").delete().eq("id", tarea.id);
    fetchData();
  }

  // Deshacer una tarea completada por error: vuelve a pendiente y devuelve las coles
  async function deshacerCompletada(tarea: Tarea) {
    if (!confirm(tr("undoTaskConfirm", { name: tarea.nombre }))) return;
    // Borrar el último movimiento de coles de esta tarea (le devuelve las coles a quien la completó)
    const { data: ultimoMov } = await supabase
      .from("coles_log")
      .select("id")
      .eq("tarea_id", tarea.id)
      .lt("coles_delta", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultimoMov) await supabase.from("coles_log").delete().eq("id", ultimoMov.id);
    await supabase.from("tareas").update({ estado: "pendiente" }).eq("id", tarea.id);
    fetchData();
  }

  // ── Coles del mes actual ──
  const mesActual = hoy().slice(0, 7);
  const movsMes = coles.filter((c) => c.created_at.slice(0, 7) === mesActual);
  const reducidasPor = new Map<string, number>();
  for (const m of movsMes) {
    reducidasPor.set(m.usuario_nombre, (reducidasPor.get(m.usuario_nombre) || 0) - m.coles_delta);
  }
  for (const a of admins) {
    if (!reducidasPor.has(a.nombre)) reducidasPor.set(a.nombre, 0);
  }
  const ranking = [...reducidasPor.entries()].sort((a, b) => b[1] - a[1]);
  const nombreMesActual = `${t.months[parseInt(mesActual.slice(5)) - 1]} ${mesActual.slice(0, 4)}`;

  // ── Historial de coles mes a mes (meses anteriores) ──
  const porMesColes = new Map<string, Map<string, number>>();
  for (const m of coles) {
    const ym = m.created_at.slice(0, 7);
    if (ym === mesActual) continue;
    const mes = porMesColes.get(ym) || new Map<string, number>();
    mes.set(m.usuario_nombre, (mes.get(m.usuario_nombre) || 0) - m.coles_delta);
    porMesColes.set(ym, mes);
  }
  const historialColes = [...porMesColes.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const freqLabel: Record<Frecuencia, string> = {
    diaria: t.freqDaily, semanal: t.freqWeekly, mensual: t.freqMonthly, puntual: t.freqOnce,
  };

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

  function TareaCard({ tarea }: { tarea: Tarea }) {
    const atrasada = estaAtrasada(tarea);
    const asignada = nombreDe(tarea.asignada_a);
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{tarea.nombre}</p>
            {tarea.descripcion && <p className="text-xs text-gray-500 mt-0.5">{tarea.descripcion}</p>}
          </div>
          <span className="shrink-0 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
            {tr("colesN", { n: tarea.puntos_coles })}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tarea.categoria}</span>
          <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{freqLabel[tarea.frecuencia]}</span>
          {asignada && <span className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{asignada}</span>}
          {tarea.rotacion && (tarea.orden_rotacion || []).length > 1 && (
            <span className="bg-purple-50 text-purple-700 rounded-full px-2 py-0.5">
              {t.rotatingBadge} · {tr("rotationNextUp", { name: nombreDe(tarea.orden_rotacion[(tarea.rotacion_idx + 1) % tarea.orden_rotacion.length]) || "—" })}
            </span>
          )}
          {tarea.proxima_fecha && (
            <span className={`rounded-full px-2 py-0.5 ${atrasada ? "bg-red-50 text-red-600 font-semibold" : "bg-gray-100 text-gray-600"}`}>
              {atrasada ? `⚠ ${t.overdueBadge} · ` : ""}{tarea.proxima_fecha}
            </span>
          )}
          {tarea.estado === "urgente" && <span className="bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">{t.urgentBadge}</span>}
        </div>
        {completando === tarea.id ? (
          <div className="flex gap-2 items-center pt-1">
            <select value={quien} onChange={(e) => setQuien(e.target.value)} className={inputClass + " flex-1"}>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
            <button
              onClick={() => completarTarea(tarea, quien)}
              className="shrink-0 bg-black text-white text-xs font-medium rounded-lg px-4 py-2"
            >
              {t.ok}
            </button>
            <button onClick={() => setCompletando(null)} className="shrink-0 text-gray-400 text-xs px-2">{t.cancel}</button>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setCompletando(tarea.id); setQuien(user?.id || admins[0]?.id || ""); }}
              className="flex-1 bg-emerald-600 text-white text-xs font-medium rounded-lg py-2"
            >
              {t.completeBtn}
            </button>
            <button onClick={() => eliminarTarea(tarea)} className="shrink-0 text-gray-300 hover:text-red-500 px-2 text-lg leading-none">×</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.tasks}</h1>
        <p className="text-gray-500 text-sm">{t.tasksSubtitle}</p>
      </div>

      {aviso && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3">{aviso}</div>}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {([
          { id: "activas", label: t.activeTab, badge: activas.filter(estaAtrasada).length },
          { id: "pendientes", label: t.pendingTab, badge: pendientes.length },
          { id: "completadas", label: t.completedTab, badge: 0 },
          { id: "coles", label: t.colesTab, badge: 0 },
        ] as { id: Tab; label: string; badge: number }[]).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 py-2.5 px-0.5 rounded-xl font-medium text-[11px] whitespace-nowrap transition-colors ${tab === tb.id ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {tb.label}
            {tb.badge > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{tb.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "activas" && (
        <div className="space-y-3">
          {/* Nueva tarea */}
          {formAbierto ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <input type="text" value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder={t.taskName} className={inputClass} autoFocus />
              <input type="text" value={fDescripcion} onChange={(e) => setFDescripcion(e.target.value)} placeholder={t.taskDescription} className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t.assignedTo}</label>
                  <select value={fAsignada} onChange={(e) => setFAsignada(e.target.value)} className={inputClass}>
                    <option value="">{t.unassigned}</option>
                    {admins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t.frequency}</label>
                  <select value={fFrecuencia} onChange={(e) => setFFrecuencia(e.target.value as Frecuencia)} className={inputClass}>
                    <option value="puntual">{t.freqOnce}</option>
                    <option value="diaria">{t.freqDaily}</option>
                    <option value="semanal">{t.freqWeekly}</option>
                    <option value="mensual">{t.freqMonthly}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.nextDate}</label>
                <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className={inputClass} />
              </div>
              {fFrecuencia !== "puntual" && admins.length > 1 && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-purple-900">{t.rotationToggle}</span>
                    <input type="checkbox" checked={fRotacion} onChange={(e) => setFRotacion(e.target.checked)} className="w-5 h-5 accent-purple-700" />
                  </label>
                  {fRotacion && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-purple-700 mb-1">{t.rotationStartsWith}</label>
                        <select value={fEmpieza} onChange={(e) => setFEmpieza(e.target.value)} className={inputClass}>
                          {admins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-purple-700 mb-1">{t.rotationCycles}</label>
                        <input
                          type="number" inputMode="numeric" min={1} max={8}
                          value={fCiclos}
                          onChange={(e) => setFCiclos(Math.max(1, parseInt(e.target.value) || 1))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.difficulty}</label>
                <div className="flex gap-2">
                  {([
                    { d: "simple", label: t.diffSimple },
                    { d: "media", label: t.diffMedia },
                    { d: "compleja", label: t.diffCompleja },
                  ] as { d: Dificultad; label: string }[]).map(({ d, label }) => (
                    <button
                      key={d}
                      onClick={() => setDificultad(d)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${fDificultad === d ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {fDificultad === "compleja" && (
                  <div className="flex gap-2 mt-2">
                    {[3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setFColes(n)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${fColes === n ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}
                      >
                        −{n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={crearTarea}
                  disabled={!fNombre.trim() || creando}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {creando ? t.saving : t.createTask}
                </button>
                <button onClick={() => setFormAbierto(false)} className="px-4 text-sm text-gray-400">{t.cancel}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setFormAbierto(true)}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors"
            >
              {t.newTask}
            </button>
          )}

          {activas.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noActiveTasks}</p>}
          {/* Lo más nuevo arriba, para no perder de vista lo recién añadido */}
          {[...activas].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((tarea) => <TareaCard key={tarea.id} tarea={tarea} />)}
        </div>
      )}

      {tab === "pendientes" && (
        <div className="space-y-3">
          {pendientes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noTasks}</p>}
          {/* Atrasadas primero, luego por fecha límite */}
          {[...pendientes].sort((a, b) => {
            const aa = estaAtrasada(a) ? 0 : 1;
            const bb = estaAtrasada(b) ? 0 : 1;
            if (aa !== bb) return aa - bb;
            return (a.proxima_fecha || "9999").localeCompare(b.proxima_fecha || "9999");
          }).map((tarea) => <TareaCard key={tarea.id} tarea={tarea} />)}
        </div>
      )}

      {tab === "completadas" && (
        <div className="space-y-2">
          {completadas.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noCompletedTasks}</p>}
          {completadas.map((tarea) => (
            <div key={tarea.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-500 line-through">{tarea.nombre}</p>
                <p className="text-[11px] text-gray-400">{t.completedOn} · {tarea.updated_at.slice(0, 10)}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-600">{tr("colesN", { n: tarea.puntos_coles })}</span>
                <button
                  onClick={() => deshacerCompletada(tarea)}
                  title={t.undoCompleted}
                  className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>
                  </svg>
                  {t.undoCompleted}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "coles" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-900">{tr("colesMonthTitle", { month: nombreMesActual })}</p>
              <p className="text-xs text-gray-400 mt-1">{t.colesExplain}</p>
            </div>
            {ranking.map(([nombre, reducidas], idx) => {
              const restantes = Math.max(0, COLES_MES - reducidas);
              const pct = Math.min(100, Math.round((reducidas / COLES_MES) * 100));
              return (
                <div key={nombre}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm text-gray-800">
                      {idx === 0 && reducidas > 0 && <TrofeoIcon />}{nombre}
                    </span>
                    <span className="text-xs text-gray-500">
                      <span className="font-semibold text-purple-600">{tr("colesReduced", { n: reducidas })}</span>
                      {" · "}{tr("colesLeft", { n: restantes })}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Historial mes a mes */}
          {historialColes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.colesHistoryTitle}</p>
              {historialColes.map(([ym, porPersona]) => {
                const filas = [...porPersona.entries()].sort((a, b) => b[1] - a[1]);
                const max = Math.max(1, ...filas.map(([, n]) => n));
                return (
                  <div key={ym}>
                    <p className="text-sm font-semibold text-gray-800 mb-1.5">
                      {t.months[parseInt(ym.slice(5)) - 1]} {ym.slice(0, 4)}
                    </p>
                    {filas.map(([nombre, reducidas], idx) => (
                      <div key={nombre} className="mb-1.5">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-xs text-gray-700">{idx === 0 && reducidas > 0 && <TrofeoIcon size={12} />}{nombre}</span>
                          <span className="text-xs font-semibold text-purple-600">−{reducidas}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-400" style={{ width: `${Math.round((reducidas / max) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-4 pt-4 pb-2">{t.latestColesMoves}</p>
            {coles.slice(0, 15).map((m, idx) => (
              <div key={m.id} className={`flex justify-between items-center px-4 py-2.5 gap-2 ${idx < 14 ? "border-b border-gray-100" : ""}`}>
                <div className="min-w-0">
                  <p className="text-xs text-gray-700 truncate">{m.motivo}</p>
                  <p className="text-[10px] text-gray-400">{m.usuario_nombre} · {m.created_at.slice(0, 10)}</p>
                </div>
                <span className={`shrink-0 text-xs font-bold ${m.coles_delta < 0 ? "text-purple-600" : "text-gray-500"}`}>
                  {m.coles_delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
