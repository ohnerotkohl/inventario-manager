"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/app/components/LangProvider";

// "Ese día no hubo mercado": se usa en Cierre (ventas) y en Balance (dinero).
// Los dos guardan en la misma tabla `cancelaciones`, así que marcarlo en uno
// cuenta para los dos (y para Estadísticas y Finanzas). No toca ventas ni stock.

export type DiaSinMercado = { id: string; mercado_nombre: string; fecha: string; motivo: string | null };

export default function NoHuboMercado({
  mercados,
  mercadoInicial,
  fechaInicial,
  registradoPor,
  onRegistrado,
}: {
  mercados: { id: string; nombre: string }[];
  mercadoInicial?: string;
  fechaInicial: string;
  registradoPor?: string;
  onRegistrado?: (d: DiaSinMercado) => void;
}) {
  const { t, tr } = useLang();
  const [abierto, setAbierto] = useState(false);
  const [mercadoId, setMercadoId] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Al abrir, parte del mercado y la fecha que se están usando en la pantalla
  useEffect(() => {
    if (!abierto) return;
    setMercadoId(mercados.some((m) => m.id === mercadoInicial) ? mercadoInicial! : "");
    setFecha(fechaInicial);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const fechaBonita = (f: string) =>
    new Date(f + "T12:00:00").toLocaleDateString("es-DE", { weekday: "long", day: "numeric", month: "long" });

  async function guardar() {
    if (!mercadoId || !fecha || guardando) return;
    setGuardando(true);
    const nombre = mercados.find((m) => m.id === mercadoId)?.nombre || "";
    // No duplicar: si ese mercado ya está marcado ese día, solo avisar
    const { data: ya } = await supabase
      .from("cancelaciones").select("id").eq("mercado_id", mercadoId).eq("fecha", fecha).maybeSingle();
    if (ya) {
      setGuardando(false);
      setAviso({ ok: true, texto: tr("noMarketAlready", { market: nombre, date: fechaBonita(fecha) }) });
      setAbierto(false);
      return;
    }
    const { data, error } = await supabase.from("cancelaciones").insert({
      mercado_id: mercadoId,
      mercado_nombre: nombre,
      fecha,
      motivo: motivo.trim() || null,
      registrado_por: registradoPor?.trim() || null,
    }).select("id, mercado_nombre, fecha, motivo").single();
    setGuardando(false);
    if (error || !data) { setAviso({ ok: false, texto: t.saveError }); return; }
    onRegistrado?.(data as DiaSinMercado);
    setAviso({ ok: true, texto: tr("noMarketSaved", { market: nombre, date: fechaBonita(fecha) }) });
    setAbierto(false);
    setMotivo("");
  }

  const campo = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";
  const RAPIDOS = [t.noMarketQuickHeat, t.noMarketQuickRain, t.noMarketQuickSkipped];

  return (
    <div className="space-y-3">
      {aviso && (
        <div className={`text-sm rounded-xl px-4 py-3 border ${aviso.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {aviso.ok ? "✓ " : ""}{aviso.texto}
        </div>
      )}
      {abierto ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{t.noMarketTitle}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t.noMarketHint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.market}</label>
              <select value={mercadoId} onChange={(e) => setMercadoId(e.target.value)} className={campo}>
                <option value="">{t.selectBox}</option>
                {mercados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.date}</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.cancelReason}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {RAPIDOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMotivo(r)}
                  className={`text-xs rounded-full px-3 py-1 border transition-colors ${motivo === r ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t.cancelReasonPh} className={campo} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={!mercadoId || !fecha || guardando}
              className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              {guardando ? t.saving : t.noMarketSave}
            </button>
            <button onClick={() => setAbierto(false)} className="px-4 text-sm text-gray-400">{t.cancel}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setAviso(null); setAbierto(true); }}
          className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-600 rounded-2xl py-3 text-sm font-semibold hover:border-gray-400 hover:text-gray-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            <line x1="9" y1="14" x2="15" y2="20" /><line x1="15" y1="14" x2="9" y2="20" />
          </svg>
          {t.noMarketButton}
        </button>
      )}
    </div>
  );
}
