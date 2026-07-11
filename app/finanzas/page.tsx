"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, fetchAllRows } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";
import type { Mercado, Balance } from "@/lib/types";

type Tab = "negocio" | "personal" | "gastos";

interface Gasto {
  id: string;
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  registrado_por: string | null;
}

interface IngresoHistorico {
  id: string;
  fecha: string;
  evento: string;
  total: number;
}

interface Cancelacion {
  id: string;
  mercado_nombre: string;
  fecha: string;
  motivo: string | null;
}

const CATEGORIAS_GASTO = [
  "Material de impresión",
  "Material de packaging",
  "Mensajería y envíos",
  "Suscripciones y software",
  "Alquiler y estudio",
  "Otros",
];

function eur(n: number): string {
  return n.toFixed(2) + " €";
}

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Lunes de la semana a la que pertenece una fecha "YYYY-MM-DD" (semana lun–dom).
function lunesDeSemana(fecha: string): string {
  const d = new Date(fecha + "T12:00:00");
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return ymd(d);
}

// "5 may" a partir de "YYYY-MM-DD" (día + mes corto).
function diaMesCorto(fecha: string, meses: string[]): string {
  const [, m, dd] = fecha.split("-");
  return `${parseInt(dd)} ${meses[parseInt(m) - 1].slice(0, 3).toLowerCase()}`;
}

// Los ingresos históricos guardan el mercado como texto libre
function mercadoDeEvento(evento: string): { nombre: string; contab: string } {
  const e = evento.toLowerCase();
  if (e.includes("raw")) return { nombre: "RAW", contab: "nuria" };
  if (e.includes("mauer")) return { nombre: "Mauerpark", contab: "marcello" };
  if (e.startsWith("box")) return { nombre: "Boxhagener Platz", contab: "negocio" };
  if (e.startsWith("hack")) return { nombre: "Hackescher Markt", contab: "negocio" };
  if (e.includes("kollwitz")) return { nombre: "Kollwitzplatz", contab: "negocio" };
  return { nombre: evento, contab: "negocio" };
}

export default function FinanzasPage() {
  const { t, tr } = useLang();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("negocio");
  // Filtro por mes natural (feedback: los rangos de días eran ambiguos)
  const [mes, setMes] = useState<string>("todo");
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [historicos, setHistoricos] = useState<IngresoHistorico[]>([]);
  const [cancelaciones, setCancelaciones] = useState<Cancelacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceAbierto, setBalanceAbierto] = useState<string | null>(null);
  // Mercado desplegado en "Por mercado" (muestra el desglose por semana)
  const [mercadoAbierto, setMercadoAbierto] = useState<string | null>(null);

  // Formulario de gasto
  const [gConcepto, setGConcepto] = useState("");
  const [gImporte, setGImporte] = useState(0);
  const [gFecha, setGFecha] = useState(hoy());
  const [gCategoria, setGCategoria] = useState("Otros");
  const [gGuardando, setGGuardando] = useState(false);
  // Si está editando un gasto existente, guarda su id (si no, null = nuevo)
  const [gEditandoId, setGEditandoId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    fetchData();
  }, [user]);

  async function fetchData() {
    // balances/gastos/históricos paginados: sin ello se truncarían en 1000 filas
    // y los totales de finanzas saldrían incompletos sin aviso al superarlo.
    const [mRes, balances, gastos, historicos, cancRes] = await Promise.all([
      supabase.from("mercados").select("*"),
      fetchAllRows<Balance>(() => supabase.from("balances").select("*").order("fecha", { ascending: false })),
      fetchAllRows<Gasto>(() => supabase.from("gastos").select("*").order("fecha", { ascending: false })),
      fetchAllRows<IngresoHistorico>(() => supabase.from("ingresos_historicos").select("*").order("fecha", { ascending: false })),
      supabase.from("cancelaciones").select("id, mercado_nombre, fecha, motivo").order("fecha", { ascending: false }),
    ]);
    setMercados(mRes.data || []);
    setBalances(balances);
    setGastos(gastos);
    setHistoricos(historicos);
    setCancelaciones((cancRes.data as Cancelacion[]) || []);
    setLoading(false);
  }

  if (loading) return <SkeletonPage />;
  if (user?.rol === "empleado") return null;

  const propio = (user?.nombre || "").toLowerCase();

  function contabDe(b: Balance): string {
    if (!b.mercado_id) return "negocio";
    return mercados.find((m) => m.id === b.mercado_id)?.contabilidad || "negocio";
  }

  const mercadosPersonales = mercados.filter((m) => m.contabilidad === propio);

  // Meses disponibles: todos los que tienen datos (balances, históricos o gastos)
  const mesesDisp = [...new Set([
    ...balances.map((b) => b.fecha.slice(0, 7)),
    ...historicos.map((h) => h.fecha.slice(0, 7)),
    ...gastos.map((g) => g.fecha.slice(0, 7)),
  ])].sort((a, b) => b.localeCompare(a));
  const enRango = (fecha: string) => mes === "todo" || fecha.slice(0, 7) === mes;

  const vista = tab === "gastos" ? "negocio" : tab;
  const balancesVista = balances.filter((b) => {
    const c = contabDe(b);
    return (vista === "negocio" ? c === "negocio" : c === propio) && enRango(b.fecha);
  });
  const historicosVista = historicos.filter((h) => {
    const c = mercadoDeEvento(h.evento).contab;
    return (vista === "negocio" ? c === "negocio" : c === propio) && enRango(h.fecha);
  });
  // Los gastos del estudio son del negocio compartido
  const gastosVista = vista === "negocio" ? gastos.filter((g) => enRango(g.fecha)) : [];

  const ingresosTotal =
    balancesVista.reduce((s, b) => s + Number(b.total_ventas), 0) +
    historicosVista.reduce((s, h) => s + Number(h.total), 0);
  const gastosTotal =
    balancesVista.reduce((s, b) => s + Number(b.total_gastos), 0) +
    gastosVista.reduce((s, g) => s + Number(g.importe), 0);
  const neto = ingresosTotal - gastosTotal;
  const gastosEstudioTotal = gastosVista.reduce((s, g) => s + Number(g.importe), 0);

  // Agrupar por mes (balances + históricos + gastos estudio)
  const porMes = new Map<string, { ingresos: number; gastos: number; neto: number; historico: boolean; real: boolean }>();
  function acumular(ym: string, ingresos: number, gastosMes: number, esReal: boolean) {
    const acc = porMes.get(ym) || { ingresos: 0, gastos: 0, neto: 0, historico: false, real: false };
    acc.ingresos += ingresos;
    acc.gastos += gastosMes;
    acc.neto += ingresos - gastosMes;
    if (esReal) acc.real = true;
    else acc.historico = true;
    porMes.set(ym, acc);
  }
  for (const b of balancesVista) acumular(b.fecha.slice(0, 7), Number(b.total_ventas), Number(b.total_gastos), true);
  for (const h of historicosVista) acumular(h.fecha.slice(0, 7), Number(h.total), 0, false);
  for (const g of gastosVista) acumular(g.fecha.slice(0, 7), 0, Number(g.importe), true);
  const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const maxNeto = Math.max(1, ...meses.map(([, v]) => Math.abs(v.neto)));

  // Agrupar por mercado (balances + históricos)
  const porMercado = new Map<string, { neto: number; count: number }>();
  for (const b of balancesVista) {
    const acc = porMercado.get(b.mercado_nombre) || { neto: 0, count: 0 };
    acc.neto += Number(b.neto);
    acc.count += 1;
    porMercado.set(b.mercado_nombre, acc);
  }
  for (const h of historicosVista) {
    const nombre = mercadoDeEvento(h.evento).nombre;
    const acc = porMercado.get(nombre) || { neto: 0, count: 0 };
    acc.neto += Number(h.total);
    acc.count += 1;
    porMercado.set(nombre, acc);
  }
  const mercadosOrdenados = [...porMercado.entries()].sort((a, b) => b[1].neto - a[1].neto);

  // Desglose por semana de un mercado concreto (dentro del mes/rango filtrado):
  // ingresos de balances + históricos y las cancelaciones registradas de ese mercado.
  function semanasDeMercado(nombre: string) {
    const semanas = new Map<string, { neto: number; count: number; cancelada: boolean; motivo: string | null }>();
    const get = (fecha: string) => {
      const lunes = lunesDeSemana(fecha);
      if (!semanas.has(lunes)) semanas.set(lunes, { neto: 0, count: 0, cancelada: false, motivo: null });
      return semanas.get(lunes)!;
    };
    for (const b of balancesVista) {
      if (b.mercado_nombre !== nombre) continue;
      const s = get(b.fecha);
      s.neto += Number(b.neto);
      s.count += 1;
    }
    for (const h of historicosVista) {
      if (mercadoDeEvento(h.evento).nombre !== nombre) continue;
      const s = get(h.fecha);
      s.neto += Number(h.total);
      s.count += 1;
    }
    for (const c of cancelaciones) {
      if (c.mercado_nombre !== nombre || !enRango(c.fecha)) continue;
      const s = get(c.fecha);
      s.cancelada = true;
      if (!s.motivo) s.motivo = c.motivo;
    }
    return [...semanas.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }

  function nombreMes(ym: string): string {
    const [y, m] = ym.split("-");
    return `${t.months[parseInt(m) - 1]} ${y}`;
  }

  function limpiarFormGasto() {
    setGConcepto(""); setGImporte(0); setGFecha(hoy()); setGCategoria("Otros");
    setGEditandoId(null);
  }

  // Cargar un gasto en el formulario para editarlo (conserva fecha y quién lo registró).
  function abrirEdicionGasto(g: Gasto) {
    setGConcepto(g.descripcion);
    setGImporte(Number(g.importe));
    setGFecha(g.fecha);
    setGCategoria(g.categoria);
    setGEditandoId(g.id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarGasto() {
    if (!gConcepto.trim() || gImporte <= 0 || gGuardando) return;
    setGGuardando(true);
    const campos = {
      fecha: gFecha,
      importe: gImporte,
      descripcion: gConcepto.trim(),
      categoria: gCategoria,
    };
    // Si editamos, actualizamos ese gasto; si no, creamos uno nuevo.
    const { error } = gEditandoId
      ? await supabase.from("gastos").update(campos).eq("id", gEditandoId)
      : await supabase.from("gastos").insert({ ...campos, registrado_por: user?.nombre || null });
    setGGuardando(false);
    if (error) { alert(t.saveError); return; }
    limpiarFormGasto();
    fetchData();
  }

  async function eliminarGasto(g: Gasto) {
    if (!confirm(tr("deleteExpenseConfirm", { name: g.descripcion, amount: eur(Number(g.importe)) }))) return;
    const { error } = await supabase.from("gastos").delete().eq("id", g.id);
    if (error) { alert(t.saveError); return; }
    if (gEditandoId === g.id) limpiarFormGasto();
    fetchData();
  }

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.finance}</h1>
        <p className="text-gray-500 text-sm">{t.financeSubtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: "negocio", label: t.businessTab },
          { id: "personal", label: t.personalTab },
          { id: "gastos", label: t.expensesTab },
        ] as { id: Tab; label: string }[]).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === tb.id ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab !== "gastos" && (
        <>
          {/* Qué mercados entran en esta vista */}
          <p className="text-xs text-gray-400">
            {tab === "negocio"
              ? tr("includedMarkets", { list: mercados.filter((m) => m.contabilidad === "negocio" || !m.contabilidad).map((m) => m.nombre).join(", ") })
              : mercadosPersonales.length > 0
                ? tr("includedMarkets", { list: mercadosPersonales.map((m) => m.nombre).join(", ") })
                : t.noPersonalMarkets}
          </p>

          {/* Selector de mes natural */}
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-full text-sm font-medium border border-gray-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-black"
          >
            <option value="todo">{t.allMonths}</option>
            {mesesDisp.map((ym) => <option key={ym} value={ym} className="capitalize">{nombreMes(ym)}</option>)}
          </select>

          {/* Totales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500">{t.incomeLabel}</p>
              <p className="text-xl font-bold text-green-600">{eur(ingresosTotal)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500">{t.expensesShort}</p>
              <p className="text-xl font-bold text-red-600">{eur(gastosTotal)}</p>
            </div>
          </div>
          <div className="bg-white border-2 border-black rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">{t.netLabel}</p>
              <p className="text-[11px] text-gray-400">
                {tr("balancesCount", { n: balancesVista.length + historicosVista.length })}
              </p>
            </div>
            <p className={`text-2xl font-bold ${neto >= 0 ? "text-green-600" : "text-red-600"}`}>
              {neto >= 0 ? "+" : ""}{eur(neto)}
            </p>
          </div>

          {historicosVista.length > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              {tr("histIncludedNote", { n: historicosVista.length })}
            </p>
          )}
          {tab === "negocio" && gastosEstudioTotal > 0 && (
            <p className="text-[11px] text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {tr("studioExpensesNote", { amount: eur(gastosEstudioTotal) })}
            </p>
          )}

          {balancesVista.length + historicosVista.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">{t.noBalances}</p>
          )}

          {/* Neto por mes */}
          {meses.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.netByMonth}</p>
              {meses.map(([ym, v]) => (
                <div key={ym}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm text-gray-700">{nombreMes(ym)}</span>
                    <span className={`text-sm font-semibold ${v.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {v.neto >= 0 ? "+" : ""}{eur(v.neto)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${v.neto >= 0 ? "bg-green-500" : "bg-red-400"}`}
                      style={{ width: `${Math.round((Math.abs(v.neto) / maxNeto) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {eur(v.ingresos)} {t.incomeLabel.toLowerCase()} · {eur(v.gastos)} {t.expensesShort.toLowerCase()}
                    {v.historico && !v.real && <span className="ml-1.5 text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{t.histMonthBadge}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Por mercado — tocar un mercado despliega el desglose por semana */}
          {mercadosOrdenados.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-4 pt-4 pb-2">{t.byMarket}</p>
              {mercadosOrdenados.map(([nombre, v], idx) => {
                const open = mercadoAbierto === nombre;
                const semanas = open ? semanasDeMercado(nombre) : [];
                return (
                  <div key={nombre} className={idx < mercadosOrdenados.length - 1 ? "border-b border-gray-100" : ""}>
                    <button
                      onClick={() => setMercadoAbierto(open ? null : nombre)}
                      className="w-full flex justify-between items-center px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-gray-400 text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
                        <div>
                          <p className="text-sm text-gray-800">{nombre}</p>
                          <p className="text-xs text-gray-400">{tr("balancesCount", { n: v.count })}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${v.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {v.neto >= 0 ? "+" : ""}{eur(v.neto)}
                      </p>
                    </button>
                    {open && (
                      <div className="bg-gray-50 px-4 py-2 space-y-2">
                        {semanas.length === 0 && (
                          <p className="text-xs text-gray-400 py-2">{t.noBalances}</p>
                        )}
                        {semanas.map(([lunes, s]) => {
                          const domingo = ymd(new Date(new Date(lunes + "T12:00:00").getTime() + 6 * 86400000));
                          return (
                            <div key={lunes} className="flex justify-between items-center py-1">
                              <div>
                                <p className="text-xs text-gray-700">
                                  {tr("weekOf", { start: diaMesCorto(lunes, t.months), end: diaMesCorto(domingo, t.months) })}
                                </p>
                                {s.cancelada && (
                                  <p className="text-[10px] text-amber-700">
                                    ⚠ {t.marketCancelledBadge}{s.motivo ? `: ${s.motivo}` : ""}
                                  </p>
                                )}
                              </div>
                              {s.count > 0 ? (
                                <p className={`text-xs font-semibold ${s.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {s.neto >= 0 ? "+" : ""}{eur(s.neto)}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">—</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Historial detallado de balances — solo en Personal */}
          {tab === "personal" && balancesVista.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.personalHistory}</p>
              {balancesVista.map((b) => {
                const open = balanceAbierto === b.id;
                return (
                  <div key={b.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <button onClick={() => setBalanceAbierto(open ? null : b.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{b.mercado_nombre}</p>
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
        </>
      )}

      {tab === "gastos" && (
        <div className="space-y-3">
          {/* Nuevo gasto (o edición de uno existente) */}
          <div className={`bg-white border rounded-2xl p-4 space-y-3 ${gEditandoId ? "border-amber-400" : "border-gray-200"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${gEditandoId ? "text-amber-600" : "text-red-600"}`}>
              {gEditandoId ? t.editExpense : t.studioExpenses}
            </p>
            <input type="text" value={gConcepto} onChange={(e) => setGConcepto(e.target.value)} placeholder={t.expenseConcept} className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.amountLabel}</label>
                <input
                  type="number" inputMode="decimal" min={0} step="0.01"
                  value={gImporte === 0 ? "" : gImporte} placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setGImporte(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t.date}</label>
                <input type="date" value={gFecha} onChange={(e) => setGFecha(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t.categoryLabel}</label>
              <select value={gCategoria} onChange={(e) => setGCategoria(e.target.value)} className={inputClass}>
                {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              {gEditandoId && (
                <button
                  onClick={limpiarFormGasto}
                  disabled={gGuardando}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm"
                >
                  {t.cancel}
                </button>
              )}
              <button
                onClick={guardarGasto}
                disabled={!gConcepto.trim() || gImporte <= 0 || gGuardando}
                className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
              >
                {gGuardando ? t.saving : gEditandoId ? t.saveChanges : t.addStudioExpense}
              </button>
            </div>
          </div>

          {/* Lista de gastos */}
          {gastos.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noExpenses}</p>}
          {gastos.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {gastos.map((g, idx) => (
                <div key={g.id} className={`flex justify-between items-center px-4 py-3 gap-2 ${idx < gastos.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{g.descripcion}</p>
                    <p className="text-xs text-gray-400">{g.fecha} · {g.categoria}{g.registrado_por ? ` · ${g.registrado_por}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <p className="text-sm font-semibold text-red-600">{eur(Number(g.importe))}</p>
                    <button onClick={() => abrirEdicionGasto(g)} title={t.editExpense} className="text-gray-300 hover:text-amber-500 text-base leading-none px-1">✎</button>
                    <button onClick={() => eliminarGasto(g)} className="text-gray-300 hover:text-red-500 text-lg leading-none px-1">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
