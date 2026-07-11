"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";
import type { Mercado, Balance, GastoBalance } from "@/lib/types";

type Tab = "nuevo" | "historial";
type TurnoTipo = "na" | "horas";

const ESPECIAL = "__especial__";

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function eur(n: number): string {
  return n.toFixed(2) + " €";
}

const NUM_CLASS = "w-24 text-right text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

function NumInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      value={value === 0 ? "" : value}
      placeholder="0"
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={className || NUM_CLASS}
    />
  );
}

export default function BalancePage() {
  const { t, tr } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("nuevo");
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario
  const [mercadoId, setMercadoId] = useState("");
  const [mercadoCustom, setMercadoCustom] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [trabajador, setTrabajador] = useState("");
  const [turnoTipo, setTurnoTipo] = useState<TurnoTipo>("na");
  const [turnoHoras, setTurnoHoras] = useState(0);
  const [turnoTarifa, setTurnoTarifa] = useState(13);
  const [floatInicial, setFloatInicial] = useState(0);
  const [gastos, setGastos] = useState<GastoBalance[]>([]);
  const [ventaSumup, setVentaSumup] = useState(0);
  // Se escribe TODO el efectivo contado (con el float dentro); la app resta el float
  const [efectivoContado, setEfectivoContado] = useState(0);
  const [ventaPaypal, setVentaPaypal] = useState(0);
  const [ivaOn, setIvaOn] = useState(false);

  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState<Balance | null>(null);
  const [emailEstado, setEmailEstado] = useState<"enviando" | "ok" | "error" | null>(null);

  // Historial
  const [historial, setHistorial] = useState<Balance[]>([]);
  const [historialCargado, setHistorialCargado] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("mercados").select("*").order("nombre").then(({ data }) => {
      setMercados(data || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user && !trabajador) setTrabajador(user.nombre);
  }, [user]);

  useEffect(() => {
    if (tab === "historial" && !historialCargado) fetchHistorial();
  }, [tab]);

  async function fetchHistorial() {
    const { data } = await supabase.from("balances").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false });
    setHistorial((data as Balance[]) || []);
    setHistorialCargado(true);
  }

  function gastosPorDefecto(mId: string, turno: TurnoTipo): GastoBalance[] {
    const mercado = mercados.find((m) => m.id === mId);
    const rows: GastoBalance[] = [{ nombre: "Stand", monto: mercado?.costo_stand || 0, efectivo: false }];
    if (turno === "na") rows.push({ nombre: "Comida", monto: 0, efectivo: false });
    rows.push({ nombre: "Transporte", monto: 0, efectivo: true });
    return rows;
  }

  function onMercadoChange(id: string) {
    setMercadoId(id);
    setGastos(gastosPorDefecto(id, turnoTipo));
  }

  function onTurnoChange(tipo: TurnoTipo) {
    setTurnoTipo(tipo);
    setGastos(gastosPorDefecto(mercadoId, tipo));
  }

  function setGasto(i: number, cambio: Partial<GastoBalance>) {
    setGastos((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...cambio } : g)));
  }

  const esAdmin = user?.rol === "admin";

  // El historial es privado: mercados del negocio para todos los admins,
  // los personales (Mauerpark/RAW) solo para su dueño
  function contabDe(b: Balance): string {
    if (!b.mercado_id) return "negocio";
    return mercados.find((m) => m.id === b.mercado_id)?.contabilidad || "negocio";
  }
  const historialVisible = historial.filter((b) => {
    const c = contabDe(b);
    return c === "negocio" || c === (user?.nombre || "").toLowerCase();
  });

  const mercadoNombre = mercadoId === ESPECIAL ? (mercadoCustom.trim() || "Especial") : (mercados.find((m) => m.id === mercadoId)?.nombre || "");
  const turnoCosto = turnoTipo === "horas" ? turnoHoras * turnoTarifa : 0;
  const ivaMonto = ivaOn ? ventaSumup * 0.19 : 0;
  const gastosManual = gastos.reduce((s, g) => s + (g.monto || 0), 0);
  const gastosEfectivo = gastos.reduce((s, g) => s + (g.efectivo ? g.monto || 0 : 0), 0);
  const totalGastos = gastosManual + ivaMonto + turnoCosto;
  // El efectivo vendido = lo contado menos el float (puede salir negativo
  // si el efectivo del día no alcanzó a cubrir el float)
  const ventaEfectivo = efectivoContado - floatInicial;
  const totalVentas = ventaSumup + ventaPaypal + ventaEfectivo + gastosEfectivo;
  const neto = totalVentas - totalGastos;

  const puedeGuardar = mercadoId && fecha && trabajador.trim() && !saving;

  async function enviarEmail(balance: Balance) {
    setEmailEstado("enviando");
    try {
      const res = await fetch("/api/email/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(balance),
      });
      if (!res.ok) throw new Error("email failed");
      await supabase.from("balances").update({ email_enviado: true }).eq("id", balance.id);
      setEmailEstado("ok");
    } catch {
      setEmailEstado("error");
    }
  }

  async function handleGuardar() {
    if (!puedeGuardar) return;
    setSaving(true);
    const fila = {
      mercado_id: mercadoId === ESPECIAL ? null : mercadoId,
      mercado_nombre: mercadoNombre,
      fecha,
      trabajador: trabajador.trim(),
      turno_tipo: turnoTipo,
      turno_horas: turnoTipo === "horas" ? turnoHoras : 0,
      turno_tarifa: turnoTarifa,
      turno_costo: turnoCosto,
      float_inicial: floatInicial,
      venta_sumup: ventaSumup,
      venta_efectivo: ventaEfectivo,
      venta_paypal: ventaPaypal,
      iva_aplicado: ivaOn,
      iva_monto: ivaMonto,
      gastos: gastos.filter((g) => g.nombre.trim() || g.monto > 0),
      total_gastos: totalGastos,
      total_ventas: totalVentas,
      neto,
    };
    const { data, error } = await supabase.from("balances").insert(fila).select().single();
    setSaving(false);
    if (error || !data) {
      alert(t.balanceSaveError);
      return;
    }
    const balance = data as Balance;
    setGuardado(balance);
    setHistorialCargado(false);
    enviarEmail(balance);
  }

  function resetForm() {
    setGuardado(null);
    setEmailEstado(null);
    setMercadoId("");
    setMercadoCustom("");
    setFecha(hoy());
    setTrabajador(user?.nombre || "");
    setTurnoTipo("na");
    setTurnoHoras(0);
    setTurnoTarifa(13);
    setFloatInicial(0);
    setGastos([]);
    setVentaSumup(0);
    setEfectivoContado(0);
    setVentaPaypal(0);
    setIvaOn(false);
  }

  if (loading) return <SkeletonPage />;

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

  // ====== Pantalla de guardado ======
  if (guardado) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">{t.balanceSaved}</h2>
          <p className="text-gray-500 text-sm">{guardado.mercado_nombre} · {guardado.fecha} · {guardado.trabajador}</p>
          <p className={`text-3xl font-bold ${guardado.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
            {guardado.neto >= 0 ? "+" : ""}{eur(guardado.neto)}
          </p>
          <p className="text-xs text-gray-400">{eur(guardado.total_ventas)} {t.totalSalesLabel.toLowerCase()} − {eur(guardado.total_gastos)} {t.totalExpensesLabel.toLowerCase()}</p>
          {emailEstado === "enviando" && <p className="text-sm text-gray-500">{t.sending}</p>}
          {emailEstado === "ok" && <p className="text-sm text-green-600">{t.reportSent}</p>}
          {emailEstado === "error" && (
            <button onClick={() => enviarEmail(guardado)} className="text-sm text-red-600 underline">
              {t.retryEmail}
            </button>
          )}
        </div>
        <button onClick={resetForm} className="w-full py-3 rounded-xl bg-black text-white font-medium text-sm">
          {t.newBalance}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.balanceTitle}</h1>
        <p className="text-gray-500 text-sm">{t.balanceSubtitle}</p>
      </div>

      {/* Tabs — los empleados solo registran, sin historial */}
      {esAdmin && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab("nuevo")}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === "nuevo" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {t.newBalance}
          </button>
          <button
            onClick={() => setTab("historial")}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === "historial" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {t.history}
          </button>
        </div>
      )}

      {tab === "nuevo" && (
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.market}</label>
              <select value={mercadoId} onChange={(e) => onMercadoChange(e.target.value)} className={inputClass}>
                <option value="">{t.selectBox}</option>
                {mercados.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
                <option value={ESPECIAL}>{t.specialMarketOption}</option>
              </select>
            </div>
            {mercadoId === ESPECIAL && (
              <input type="text" value={mercadoCustom} onChange={(e) => setMercadoCustom(e.target.value)} placeholder={t.marketName} className={inputClass} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.date}</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.worker}</label>
                <input type="text" value={trabajador} onChange={(e) => setTrabajador(e.target.value)} placeholder={t.workerName} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.shiftLabel}</label>
              <select value={turnoTipo} onChange={(e) => onTurnoChange(e.target.value as TurnoTipo)} className={inputClass}>
                <option value="na">{t.shiftNA}</option>
                <option value="horas">{t.shiftHoursOpt}</option>
              </select>
            </div>
            {turnoTipo === "horas" && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t.hoursWorked}</span>
                  <NumInput value={turnoHoras} onChange={setTurnoHoras} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t.ratePerHour}</span>
                  <NumInput value={turnoTarifa} onChange={setTurnoTarifa} />
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className="text-xs text-gray-500">{t.shiftCost}</span>
                  <span className="text-sm font-semibold text-gray-900">{eur(turnoCosto)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Float */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600">{t.floatLabel}</label>
            <NumInput value={floatInicial} onChange={setFloatInicial} />
          </div>

          {/* Gastos */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">{t.expensesSection}</p>
            {turnoTipo === "horas" && turnoCosto > 0 && (
              <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-xs text-amber-800">{tr("shiftCostExpense", { h: turnoHoras, r: turnoTarifa })}</span>
                <span className="text-sm font-medium text-amber-800">{eur(turnoCosto)}</span>
              </div>
            )}
            {ivaOn && (
              <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-xs text-red-700">{t.vatExpense}</span>
                <span className="text-sm font-medium text-red-700">{eur(ivaMonto)}</span>
              </div>
            )}
            {gastos.map((g, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input
                  type="text"
                  value={g.nombre}
                  placeholder={t.expenseName}
                  onChange={(e) => setGasto(i, { nombre: e.target.value })}
                  className="text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black min-w-0"
                />
                <NumInput value={g.monto} onChange={(n) => setGasto(i, { monto: n })} className="w-20 text-right text-sm border border-gray-200 rounded-lg py-2 px-2 focus:outline-none focus:border-black" />
                <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={g.efectivo} onChange={(e) => setGasto(i, { efectivo: e.target.checked })} className="accent-black" />
                  {t.paidCash}
                </label>
                <button onClick={() => setGastos((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500 text-lg leading-none px-1">×</button>
              </div>
            ))}
            <button
              onClick={() => setGastos((prev) => [...prev, { nombre: "", monto: 0, efectivo: false }])}
              className="w-full text-left text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:border-black hover:text-black transition-colors"
            >
              {t.addExpense}
            </button>
          </div>

          {/* Ventas */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-green-600">{t.salesSection}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t.sumupCard}</span>
              <NumInput value={ventaSumup} onChange={setVentaSumup} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t.cashInPocket}</span>
              <NumInput value={efectivoContado} onChange={setEfectivoContado} />
            </div>
            {/* La app resta el float sola: nada de matemática mental en el mercado */}
            {(efectivoContado > 0 || floatInicial > 0) && (
              <p className={`text-[11px] rounded-lg px-3 py-2 ${ventaEfectivo < 0 ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-50"}`}>
                {t.cashAfterFloat}: {eur(efectivoContado)} − {eur(floatInicial)} = <span className="font-semibold">{eur(ventaEfectivo)}</span>
                {ventaEfectivo < 0 ? ` · ${t.negativeCashHint}` : ""}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t.paypalLabel}</span>
              <NumInput value={ventaPaypal} onChange={setVentaPaypal} />
            </div>
            {gastosEfectivo > 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                {t.cashSoldHint}: {eur(ventaEfectivo)} + {eur(gastosEfectivo)} = {eur(ventaEfectivo + gastosEfectivo)}
              </p>
            )}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-600">{t.applyVat}</span>
              <input type="checkbox" checked={ivaOn} onChange={(e) => setIvaOn(e.target.checked)} className="w-5 h-5 accent-black" />
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500">{t.totalExpensesLabel}</p>
              <p className="text-xl font-bold text-red-600">{eur(totalGastos)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500">{t.totalSalesLabel}</p>
              <p className="text-xl font-bold text-green-600">{eur(totalVentas)}</p>
            </div>
          </div>
          <div className="bg-white border-2 border-black rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">{t.netProfit}</p>
              <p className="text-[11px] text-gray-400">{t.netFormula}</p>
            </div>
            <p className={`text-2xl font-bold ${neto >= 0 ? "text-green-600" : "text-red-600"}`}>
              {neto >= 0 ? "+" : ""}{eur(neto)}
            </p>
          </div>

          <button
            onClick={handleGuardar}
            disabled={!puedeGuardar}
            className="w-full py-3 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? t.saving : t.saveBalance}
          </button>
        </div>
      )}

      {tab === "historial" && esAdmin && (
        <div className="space-y-3">
          {historialVisible.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noBalances}</p>}
          {historialVisible.map((b) => {
            const open = abierto === b.id;
            const contab = mercados.find((m) => m.id === b.mercado_id)?.contabilidad;
            const personal = contab === "marcello" || contab === "nuria";
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button onClick={() => setAbierto(open ? null : b.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {b.mercado_nombre}
                      {personal && (
                        <span className="ml-2 text-[10px] font-normal text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5 align-middle">
                          {tr("personalBadge", { name: contab === "marcello" ? "Marcello" : "Nuria" })}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{b.fecha} · {b.trabajador}</p>
                  </div>
                  <p className={`text-base font-bold ${b.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {b.neto >= 0 ? "+" : ""}{eur(b.neto)}
                  </p>
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">{t.sumupCard}</span><span>{eur(b.venta_sumup)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t.cashNet}</span><span>{eur(b.venta_efectivo)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t.paypalLabel}</span><span>{eur(b.venta_paypal)}</span></div>
                    <div className="flex justify-between font-medium"><span className="text-gray-600">{t.totalSalesLabel}</span><span className="text-green-600">{eur(b.total_ventas)}</span></div>
                    <div className="border-t border-gray-100 my-1" />
                    {(b.gastos || []).map((g, i) => (
                      <div key={i} className="flex justify-between"><span className="text-gray-500">{g.nombre || "—"}{g.efectivo ? ` (${t.paidCash})` : ""}</span><span>{eur(g.monto)}</span></div>
                    ))}
                    {b.turno_costo > 0 && (
                      <div className="flex justify-between"><span className="text-gray-500">{tr("shiftCostExpense", { h: b.turno_horas, r: b.turno_tarifa })}</span><span>{eur(b.turno_costo)}</span></div>
                    )}
                    {b.iva_aplicado && (
                      <div className="flex justify-between"><span className="text-gray-500">{t.vatExpense}</span><span>{eur(b.iva_monto)}</span></div>
                    )}
                    <div className="flex justify-between font-medium"><span className="text-gray-600">{t.totalExpensesLabel}</span><span className="text-red-600">{eur(b.total_gastos)}</span></div>
                    {b.float_inicial > 0 && (
                      <div className="flex justify-between"><span className="text-gray-400">{t.balanceFloat}</span><span className="text-gray-400">{eur(b.float_inicial)}</span></div>
                    )}
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
