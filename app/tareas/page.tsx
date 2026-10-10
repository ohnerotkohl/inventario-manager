"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";
import { veMercado } from "@/lib/perfil";

type Tab = "activas" | "pendientes" | "completadas";
type Frecuencia = "diaria" | "semanal" | "mensual" | "puntual";

interface UsuarioMin { id: string; nombre: string; rol: string }

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  asignada_a: string | null;
  frecuencia: Frecuencia;
  proxima_fecha: string | null;
  estado: "pendiente" | "atrasada" | "completada" | "urgente";
  rotacion: boolean;
  orden_rotacion: string[];
  rotacion_idx: number;
  created_at: string;
  updated_at: string;
}

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
  const [loading, setLoading] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [completando, setCompletando] = useState<string | null>(null);
  const [quien, setQuien] = useState("");
  const [aviso, setAviso] = useState("");
  const [completadaAbierta, setCompletadaAbierta] = useState<string | null>(null);

  // Formulario nueva tarea
  const [fNombre, setFNombre] = useState("");
  const [fDescripcion, setFDescripcion] = useState("");
  const [fCategoria, setFCategoria] = useState("Otra");
  const [fAsignada, setFAsignada] = useState("");
  const [fFrecuencia, setFFrecuencia] = useState<Frecuencia>("puntual");
  const [fFecha, setFFecha] = useState("");
  const [fRotacion, setFRotacion] = useState(false);
  const [fEmpieza, setFEmpieza] = useState("");
  const [fCiclos, setFCiclos] = useState(2);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    fetchData();
  }, [user]);

  async function fetchData() {
    const [tRes, uRes] = await Promise.all([
      supabase.from("tareas").select("*").order("created_at", { ascending: false }),
      supabase.from("usuarios").select("id, nombre, rol").eq("activo", true),
    ]);
    // Separación por perfil: cada quien ve solo sus tareas (y las de "ambos").
    setTareas(((tRes.data as (Tarea & { perfil?: string | null })[]) || []).filter((t) => veMercado(user?.perfil, t.perfil)));
    setUsuarios((uRes.data as UsuarioMin[]) || []);
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

  // Recientes arriba, atrasadas al final (en Activas y Puntuales)
  function ordenarTareas(lista: Tarea[]): Tarea[] {
    return [...lista].sort((a, b) => {
      const aAtras = estaAtrasada(a) ? 1 : 0;
      const bAtras = estaAtrasada(b) ? 1 : 0;
      if (aAtras !== bAtras) return aAtras - bAtras;
      return b.created_at.localeCompare(a.created_at);
    });
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
    const campos = {
      nombre: fNombre.trim(),
      descripcion: fDescripcion.trim() || null,
      categoria: fCategoria,
      asignada_a: rotacionActiva ? orden[0] : (fAsignada || null),
      frecuencia: fFrecuencia,
      proxima_fecha: fFecha || null,
      rotacion: rotacionActiva,
      orden_rotacion: orden,
      // asignada_a se fija a orden[0], así que el índice de rotación debe volver a
      // 0 para que ambos concuerden. Si no, al editar una tarea a mitad de rotación
      // completarTarea usaría un rotacion_idx viejo y asignaría a la persona equivocada.
      rotacion_idx: 0,
    };
    const { error } = editandoId
      ? await supabase.from("tareas").update(campos).eq("id", editandoId)
      : await supabase.from("tareas").insert({ ...campos, estado: "pendiente", creada_por: user?.id || null, perfil: user?.perfil || "ambos" });
    setCreando(false);
    if (error) { alert(t.saveError); return; }
    setFNombre(""); setFDescripcion(""); setFCategoria("Otra"); setFAsignada("");
    setFFrecuencia("puntual"); setFFecha("");
    setFRotacion(false); setFEmpieza(""); setFCiclos(2);
    setFormAbierto(false); setEditandoId(null);
    fetchData();
  }

  // Abrir el formulario con los datos de una tarea para editarla
  function abrirEdicion(tarea: Tarea) {
    setFNombre(tarea.nombre);
    setFDescripcion(tarea.descripcion || "");
    setFCategoria(tarea.categoria);
    setFAsignada(tarea.asignada_a || "");
    setFFrecuencia(tarea.frecuencia);
    setFFecha(tarea.proxima_fecha || "");
    if (tarea.rotacion && (tarea.orden_rotacion || []).length > 0) {
      setFRotacion(true);
      setFEmpieza(tarea.orden_rotacion[0]);
      let c = 0;
      for (const id of tarea.orden_rotacion) { if (id === tarea.orden_rotacion[0]) c++; else break; }
      setFCiclos(c);
    } else {
      setFRotacion(false); setFEmpieza(""); setFCiclos(2);
    }
    setEditandoId(tarea.id);
    setFormAbierto(true);
    setTab("activas");
  }

  function avanzarFecha(fecha: string, frecuencia: Frecuencia): string {
    const d = new Date(fecha + "T12:00:00");
    const hoyD = new Date(hoy() + "T12:00:00");
    const paso = () => {
      if (frecuencia === "diaria") d.setDate(d.getDate() + 1);
      else if (frecuencia === "semanal") d.setDate(d.getDate() + 7);
      else if (frecuencia === "mensual") d.setMonth(d.getMonth() + 1);
    };
    paso();
    // Si la tarea venía atrasada, seguir avanzando hasta una fecha futura
    // (antes sumaba 1 período desde la fecha vieja y podía quedar en el pasado → seguía "atrasada")
    let guardas = 0;
    while (d <= hoyD && guardas < 400) { paso(); guardas++; }
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
      const nuevaFecha = tarea.proxima_fecha ? avanzarFecha(tarea.proxima_fecha, tarea.frecuencia) : null;
      // Deja claro que la tarea recurrente NO desaparece: vuelve en la fecha indicada
      mensajeExtra = (nuevaFecha ? ` · ${tr("comesBack", { date: nuevaFecha })}` : "") + mensajeExtra;
      await supabase.from("tareas").update({
        proxima_fecha: nuevaFecha,
        estado: "pendiente",
        asignada_a: nuevaAsignada,
        rotacion_idx: nuevoIdx,
      }).eq("id", tarea.id);
    } else {
      await supabase.from("tareas").update({ estado: "completada" }).eq("id", tarea.id);
    }
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

  // Deshacer una tarea completada por error: vuelve a pendiente
  async function deshacerCompletada(tarea: Tarea) {
    if (!confirm(tr("undoTaskConfirm", { name: tarea.nombre }))) return;
    await supabase.from("tareas").update({ estado: "pendiente" }).eq("id", tarea.id);
    fetchData();
  }

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
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tarea.categoria}</span>
          <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{freqLabel[tarea.frecuencia]}</span>
          {asignada && <span className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{asignada}</span>}
          {tarea.rotacion && (tarea.orden_rotacion || []).length > 1 && (
            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 rounded-full px-2 py-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
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
          <div className="flex gap-2 pt-1 items-center">
            <button
              onClick={() => { setCompletando(tarea.id); setQuien(user?.id || admins[0]?.id || ""); }}
              className="flex-1 bg-emerald-600 text-white text-xs font-medium rounded-lg py-2"
            >
              {t.completeBtn}
            </button>
            <button onClick={() => abrirEdicion(tarea)} title={t.editTask} className="shrink-0 text-gray-400 hover:text-black p-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
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
              {editandoId && <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.editTask}</p>}
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
              <div className="flex gap-2">
                <button
                  onClick={crearTarea}
                  disabled={!fNombre.trim() || creando}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {creando ? t.saving : editandoId ? t.saveTask : t.createTask}
                </button>
                <button onClick={() => { setFormAbierto(false); setEditandoId(null); }} className="px-4 text-sm text-gray-400">{t.cancel}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                // Nueva tarea desde cero: limpiar cualquier rastro de edición
                setEditandoId(null);
                setFNombre(""); setFDescripcion(""); setFCategoria("Otra"); setFAsignada("");
                setFFrecuencia("puntual"); setFFecha("");
                setFRotacion(false); setFEmpieza(""); setFCiclos(2);
                setFormAbierto(true);
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors"
            >
              {t.newTask}
            </button>
          )}

          {activas.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noActiveTasks}</p>}
          {/* Lo más nuevo arriba, para no perder de vista lo recién añadido */}
          {ordenarTareas(activas).map((tarea) => <TareaCard key={tarea.id} tarea={tarea} />)}
        </div>
      )}

      {tab === "pendientes" && (
        <div className="space-y-3">
          {pendientes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noTasks}</p>}
          {ordenarTareas(pendientes).map((tarea) => <TareaCard key={tarea.id} tarea={tarea} />)}
        </div>
      )}

      {tab === "completadas" && (
        <div className="space-y-2">
          {completadas.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noCompletedTasks}</p>}
          {completadas.map((tarea) => {
            const open = completadaAbierta === tarea.id;
            return (
              <div key={tarea.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <button onClick={() => setCompletadaAbierta(open ? null : tarea.id)} className="min-w-0 text-left flex-1">
                    <p className="text-sm text-gray-500 line-through">{tarea.nombre}</p>
                    <p className="text-[11px] text-gray-400">{t.completedOn} · {tarea.updated_at.slice(0, 10)}</p>
                  </button>
                  <div className="shrink-0 flex items-center gap-2">
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
                {open && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    {tarea.descripcion
                      ? <p className="text-xs text-gray-600 whitespace-pre-wrap">{tarea.descripcion}</p>
                      : <p className="text-xs text-gray-300 italic">{t.noDescription}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
