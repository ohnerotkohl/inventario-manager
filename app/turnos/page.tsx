"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";

interface Turno {
  id: string;
  usuario_id: string | null;
  empleado_nombre: string;
  email: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion: string | null;
  email_enviado: boolean;
  created_at: string;
}

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TZ = { timeZone: "Europe/Berlin" } as const;

export default function TurnosPage() {
  const { t, tr } = useLang();
  const router = useRouter();
  const { user } = useAuth();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesVista, setMesVista] = useState(hoy().slice(0, 7));
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  // Formulario
  const [formAbierto, setFormAbierto] = useState(false);
  const [fFecha, setFFecha] = useState(hoy());
  const [fInicio, setFInicio] = useState("09:00");
  const [fFin, setFFin] = useState("17:00");
  const [fNombre, setFNombre] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fNotificar, setFNotificar] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    fetchData();
  }, [user]);

  async function fetchData() {
    const { data } = await supabase.from("turnos").select("*").order("fecha_inicio", { ascending: false });
    setTurnos((data as Turno[]) || []);
    setLoading(false);
  }

  if (loading) return <SkeletonPage />;
  if (user?.rol === "empleado") return null;

  function diaDe(turno: Turno): string {
    // Día del turno en hora de Berlín
    return new Date(turno.fecha_inicio).toLocaleDateString("sv-SE", TZ);
  }

  function horas(turno: Turno): string {
    const i = new Date(turno.fecha_inicio).toLocaleTimeString("es-DE", { ...TZ, hour: "2-digit", minute: "2-digit" });
    const f = new Date(turno.fecha_fin).toLocaleTimeString("es-DE", { ...TZ, hour: "2-digit", minute: "2-digit" });
    return `${i}–${f}`;
  }

  // ── Calendario del mes ──
  const [anio, mes] = mesVista.split("-").map(Number);
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const primerDiaSemana = (new Date(anio, mes - 1, 1).getDay() + 6) % 7; // lunes = 0
  const turnosPorDia = new Map<string, Turno[]>();
  for (const turno of turnos) {
    const d = diaDe(turno);
    turnosPorDia.set(d, [...(turnosPorDia.get(d) || []), turno]);
  }

  function cambiarMes(delta: number) {
    const d = new Date(anio, mes - 1 + delta, 1);
    setMesVista(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setDiaSel(null);
  }

  const ahora = new Date().toISOString();
  const proximos = turnos.filter((turno) => turno.fecha_fin >= ahora).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  const turnosDia = diaSel ? (turnosPorDia.get(diaSel) || []) : [];
  // Correos ya usados, para sugerir al escribir
  const emailsConocidos = [...new Set(turnos.map((turno) => turno.email).filter(Boolean))] as string[];

  async function enviarNotificacion(turno: Turno): Promise<boolean> {
    try {
      const res = await fetch("/api/email/turno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: turno.id,
          nombre: turno.empleado_nombre,
          email: turno.email,
          fecha_inicio: turno.fecha_inicio,
          fecha_fin: turno.fecha_fin,
          descripcion: turno.descripcion,
        }),
      });
      if (!res.ok) throw new Error("fail");
      await supabase.from("turnos").update({ email_enviado: true }).eq("id", turno.id);
      return true;
    } catch {
      return false;
    }
  }

  async function asignarTurno() {
    if (!fNombre.trim() || !fFecha || guardando) return;
    if (fNotificar && !fEmail.trim()) { alert(t.emailRequiredHint); return; }
    setGuardando(true);
    // El navegador del admin está en Berlín: la hora local es la hora del turno
    const inicio = new Date(`${fFecha}T${fInicio}:00`).toISOString();
    const fin = new Date(`${fFecha}T${fFin}:00`).toISOString();
    const { data, error } = await supabase.from("turnos").insert({
      empleado_nombre: fNombre.trim(),
      email: fEmail.trim() || null,
      fecha_inicio: inicio,
      fecha_fin: fin,
      descripcion: fDesc.trim() || null,
      estado: "pendiente",
    }).select().single();
    if (error || !data) { setGuardando(false); alert(t.saveError); return; }
    let texto = t.shiftSaved;
    let esError = false;
    if (fNotificar && fEmail.trim()) {
      const ok = await enviarNotificacion(data as Turno);
      texto = ok ? `${t.shiftSaved} ${tr("shiftEmailSent", { email: fEmail.trim() })}` : t.shiftEmailFailed;
      esError = !ok;
    }
    setGuardando(false);
    setAviso({ texto, error: esError });
    setTimeout(() => setAviso(null), 5000);
    setFNombre(""); setFEmail(""); setFDesc("");
    setFormAbierto(false);
    fetchData();
  }

  async function reenviar(turno: Turno) {
    if (!turno.email) return;
    const ok = await enviarNotificacion(turno);
    setAviso(ok
      ? { texto: tr("shiftEmailSent", { email: turno.email }), error: false }
      : { texto: t.shiftEmailFailed, error: true });
    setTimeout(() => setAviso(null), 5000);
    fetchData();
  }

  async function eliminar(turno: Turno) {
    if (!confirm(tr("deleteShiftConfirm", { name: turno.empleado_nombre, date: diaDe(turno) }))) return;
    await supabase.from("turnos").delete().eq("id", turno.id);
    fetchData();
  }

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

  function TurnoRow({ turno }: { turno: Turno }) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{turno.empleado_nombre}</p>
          <button onClick={() => eliminar(turno)} className="text-gray-300 hover:text-red-500 text-lg leading-none px-1">×</button>
        </div>
        <p className="text-xs text-gray-500">{diaDe(turno)} · {horas(turno)}{turno.descripcion ? ` · ${turno.descripcion}` : ""}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {turno.email && <span className="text-[10px] text-gray-400">{turno.email}</span>}
          {turno.email && (
            turno.email_enviado
              ? <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">✓ {t.emailSentBadge}</span>
              : <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{t.emailNotSentBadge}</span>
          )}
          {turno.email && (
            <button onClick={() => reenviar(turno)} className="text-[10px] text-blue-600 underline">{t.resendEmail}</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.shifts}</h1>
        <p className="text-gray-500 text-sm">{t.shiftsSubtitle}</p>
      </div>

      {aviso && (
        <div className={`text-sm rounded-xl px-4 py-3 border ${aviso.error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
          {aviso.texto}
        </div>
      )}

      {/* Calendario */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => cambiarMes(-1)} className="text-gray-400 hover:text-black px-3 py-1 text-lg">‹</button>
          <p className="text-sm font-bold text-gray-900">{t.months[mes - 1]} {anio}</p>
          <button onClick={() => cambiarMes(1)} className="text-gray-400 hover:text-black px-3 py-1 text-lg">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {t.calDays.map((d, i) => (
            <div key={i} className="text-[10px] text-gray-400 font-medium py-1">{d}</div>
          ))}
          {Array.from({ length: primerDiaSemana }).map((_, i) => <div key={`v${i}`} />)}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1;
            const fechaStr = `${mesVista}-${String(dia).padStart(2, "0")}`;
            const tiene = turnosPorDia.has(fechaStr);
            const esHoy = fechaStr === hoy();
            const sel = fechaStr === diaSel;
            return (
              <button
                key={dia}
                onClick={() => { setDiaSel(sel ? null : fechaStr); if (!sel) { setFFecha(fechaStr); } }}
                className={`relative aspect-square rounded-lg text-xs flex flex-col items-center justify-center transition-colors
                  ${sel ? "bg-black text-white" : esHoy ? "bg-gray-100 font-bold" : "hover:bg-gray-50"}`}
              >
                {dia}
                {tiene && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${sel ? "bg-white" : "bg-emerald-500"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Asignar turno */}
      {formAbierto ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.assignShift}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs text-gray-500 mb-1">{t.date}</label>
              <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.startTime}</label>
              <input type="time" value={fInicio} onChange={(e) => setFInicio(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.endTime}</label>
              <input type="time" value={fFin} onChange={(e) => setFFin(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workerName}</label>
            <input type="text" value={fNombre} onChange={(e) => setFNombre(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.workerEmail}</label>
            <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)} list="emails-conocidos" placeholder="nombre@email.com" className={inputClass} />
            <datalist id="emails-conocidos">
              {emailsConocidos.map((e) => <option key={e} value={e} />)}
            </datalist>
          </div>
          <input type="text" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={t.shiftDescription} className={inputClass} />
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-600">{t.notifyByEmail}</span>
            <input type="checkbox" checked={fNotificar} onChange={(e) => setFNotificar(e.target.checked)} className="w-5 h-5 accent-black" />
          </label>
          <div className="flex gap-2">
            <button
              onClick={asignarTurno}
              disabled={!fNombre.trim() || guardando}
              className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              {guardando ? t.sending : t.assignShift}
            </button>
            <button onClick={() => setFormAbierto(false)} className="px-4 text-sm text-gray-400">{t.cancel}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setFormAbierto(true)}
          className="w-full py-3 rounded-xl bg-black text-white font-medium text-sm"
        >
          + {t.assignShift}
        </button>
      )}

      {/* Turnos del día seleccionado o próximos */}
      {diaSel ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{diaSel}</p>
          {turnosDia.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t.noShiftsMonth}</p>}
          {turnosDia.map((turno) => <TurnoRow key={turno.id} turno={turno} />)}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.upcomingShifts}</p>
          {proximos.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t.noUpcomingShifts}</p>}
          {proximos.map((turno) => <TurnoRow key={turno.id} turno={turno} />)}
        </div>
      )}
    </div>
  );
}
