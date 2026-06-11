"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";
import type { Mercado, Balance } from "@/lib/types";

type Tab = "negocio" | "personal";
type Rango = "30" | "90" | "365" | "all";

function eur(n: number): string {
  return n.toFixed(2) + " €";
}

export default function FinanzasPage() {
  const { t, tr } = useLang();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("negocio");
  const [rango, setRango] = useState<Rango>("90");
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    Promise.all([
      supabase.from("mercados").select("*"),
      supabase.from("balances").select("*").order("fecha", { ascending: false }),
    ]).then(([mRes, bRes]) => {
      setMercados(mRes.data || []);
      setBalances((bRes.data as Balance[]) || []);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <SkeletonPage />;
  if (user?.rol === "empleado") return null;

  const propio = (user?.nombre || "").toLowerCase();

  function contabDe(b: Balance): string {
    if (!b.mercado_id) return "negocio";
    return mercados.find((m) => m.id === b.mercado_id)?.contabilidad || "negocio";
  }

  const mercadosPersonales = mercados.filter((m) => m.contabilidad === propio);

  const enTab = balances.filter((b) => {
    const c = contabDe(b);
    return tab === "negocio" ? c === "negocio" : c === propio;
  });

  const dias = rango === "all" ? null : parseInt(rango);
  const desde = dias ? new Date(Date.now() - dias * 86400000) : null;
  const visibles = enTab.filter((b) => !desde || new Date(b.fecha + "T12:00:00") >= desde);

  const ingresos = visibles.reduce((s, b) => s + Number(b.total_ventas), 0);
  const gastos = visibles.reduce((s, b) => s + Number(b.total_gastos), 0);
  const neto = visibles.reduce((s, b) => s + Number(b.neto), 0);

  // Agrupar por mes (YYYY-MM)
  const porMes = new Map<string, { ingresos: number; gastos: number; neto: number }>();
  for (const b of visibles) {
    const ym = b.fecha.slice(0, 7);
    const acc = porMes.get(ym) || { ingresos: 0, gastos: 0, neto: 0 };
    acc.ingresos += Number(b.total_ventas);
    acc.gastos += Number(b.total_gastos);
    acc.neto += Number(b.neto);
    porMes.set(ym, acc);
  }
  const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const maxNeto = Math.max(1, ...meses.map(([, v]) => Math.abs(v.neto)));

  // Agrupar por mercado
  const porMercado = new Map<string, { neto: number; count: number }>();
  for (const b of visibles) {
    const acc = porMercado.get(b.mercado_nombre) || { neto: 0, count: 0 };
    acc.neto += Number(b.neto);
    acc.count += 1;
    porMercado.set(b.mercado_nombre, acc);
  }
  const mercadosOrdenados = [...porMercado.entries()].sort((a, b) => b[1].neto - a[1].neto);

  function nombreMes(ym: string): string {
    const [y, m] = ym.split("-");
    return `${t.months[parseInt(m) - 1]} ${y}`;
  }

  const rangos: { id: Rango; label: string }[] = [
    { id: "30", label: t.days30 },
    { id: "90", label: t.months3 },
    { id: "365", label: t.year1 },
    { id: "all", label: t.all },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.finance}</h1>
        <p className="text-gray-500 text-sm">{t.financeSubtitle}</p>
      </div>

      {/* Tabs Negocio / Personal */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("negocio")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === "negocio" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          {t.businessTab}
        </button>
        <button
          onClick={() => setTab("personal")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === "personal" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
        >
          {t.personalTab}
        </button>
      </div>

      {/* Qué mercados entran en esta vista */}
      <p className="text-xs text-gray-400">
        {tab === "negocio"
          ? tr("includedMarkets", { list: mercados.filter((m) => m.contabilidad === "negocio" || !m.contabilidad).map((m) => m.nombre).join(", ") })
          : mercadosPersonales.length > 0
            ? tr("includedMarkets", { list: mercadosPersonales.map((m) => m.nombre).join(", ") })
            : t.noPersonalMarkets}
      </p>

      {/* Rango temporal */}
      <div className="flex gap-2">
        {rangos.map((r) => (
          <button
            key={r.id}
            onClick={() => setRango(r.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${rango === r.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">{t.incomeLabel}</p>
          <p className="text-xl font-bold text-green-600">{eur(ingresos)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">{t.expensesShort}</p>
          <p className="text-xl font-bold text-red-600">{eur(gastos)}</p>
        </div>
      </div>
      <div className="bg-white border-2 border-black rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">{t.netLabel}</p>
          <p className="text-[11px] text-gray-400">{tr("balancesCount", { n: visibles.length })}</p>
        </div>
        <p className={`text-2xl font-bold ${neto >= 0 ? "text-green-600" : "text-red-600"}`}>
          {neto >= 0 ? "+" : ""}{eur(neto)}
        </p>
      </div>

      {visibles.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.noBalances}</p>}

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
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Por mercado */}
      {mercadosOrdenados.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 px-4 pt-4 pb-2">{t.byMarket}</p>
          {mercadosOrdenados.map(([nombre, v], idx) => (
            <div key={nombre} className={`flex justify-between items-center px-4 py-3 ${idx < mercadosOrdenados.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div>
                <p className="text-sm text-gray-800">{nombre}</p>
                <p className="text-xs text-gray-400">{tr("balancesCount", { n: v.count })}</p>
              </div>
              <p className={`text-sm font-semibold ${v.neto >= 0 ? "text-green-600" : "text-red-600"}`}>
                {v.neto >= 0 ? "+" : ""}{eur(v.neto)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
