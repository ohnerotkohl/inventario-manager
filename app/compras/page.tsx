"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Caja, MaterialCaja, InsumoEstudio } from "@/lib/types";
import { SkeletonPage } from "@/app/components/Skeleton";
import { AlertTriangle, Check, Mail } from "@/app/components/Icons";

type Tab = "cajas" | "estudio";

export default function ComprasPage() {
  const [tab, setTab] = useState<Tab>("cajas");
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [materiales, setMateriales] = useState<MaterialCaja[]>([]);
  const [insumos, setInsumos] = useState<InsumoEstudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const debouncers = useRef<{ [id: string]: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [cajasRes, matRes, insRes] = await Promise.all([
      supabase.from("cajas").select("*"),
      supabase.from("materiales_caja").select("*, cajas(nombre)"),
      supabase.from("insumos_estudio").select("*").order("nombre"),
    ]);
    setCajas(cajasRes.data || []);
    setMateriales(matRes.data || []);
    setInsumos(insRes.data || []);
    setLoading(false);
  }

  async function toggleMaterial(id: string, current: boolean) {
    await supabase.from("materiales_caja").update({ necesita_restock: !current }).eq("id", id);
    setMateriales((prev) => prev.map((m) => (m.id === id ? { ...m, necesita_restock: !current } : m)));
  }

  async function toggleInsumo(id: string, current: boolean) {
    await supabase.from("insumos_estudio").update({ necesita_compra: !current }).eq("id", id);
    setInsumos((prev) => prev.map((i) => (i.id === id ? { ...i, necesita_compra: !current } : i)));
  }

  function updateCantidad(id: string, cantidad: number) {
    // Actualiza la UI inmediatamente (optimista)
    setInsumos((prev) => prev.map((i) => (i.id === id ? { ...i, cantidad } : i)));
    // Guarda en Supabase con debounce para no disparar una petición por tecla
    if (debouncers.current[id]) clearTimeout(debouncers.current[id]);
    debouncers.current[id] = setTimeout(() => {
      supabase.from("insumos_estudio").update({ cantidad }).eq("id", id);
    }, 500);
  }

  async function enviarEmail() {
    setSending(true);
    const materialesRestock = materiales.filter((m) => m.necesita_restock);
    const insumosCompra = insumos.filter((i) => i.necesita_compra);

    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materialesRestock, insumosCompra, cajas }),
    });

    if (res.ok) {
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } else {
      alert("Error enviando el email. Revisa la configuración.");
    }
    setSending(false);
  }

  const totalAlertasMat = materiales.filter((m) => m.necesita_restock).length;
  const totalAlertasIns = insumos.filter((i) => i.necesita_compra).length;
  const totalAlertas = totalAlertasMat + totalAlertasIns;

  if (loading) return <SkeletonPage />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
        <p className="text-gray-500 text-sm">Materiales de cajas e insumos del estudio</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("cajas")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            tab === "cajas" ? "bg-black text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Materiales de cajas
          {totalAlertasMat > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{totalAlertasMat}</span>
          )}
        </button>
        <button
          onClick={() => setTab("estudio")}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            tab === "estudio" ? "bg-black text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          Insumos estudio
          {totalAlertasIns > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{totalAlertasIns}</span>
          )}
        </button>
      </div>

      {tab === "cajas" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Marca lo que falta en cada caja. Se repondrá desde el stock del estudio.
          </p>
          {cajas.map((caja) => {
            const matsCaja = materiales.filter((m) => m.caja_id === caja.id);
            return (
              <div key={caja.id}>
                <p className="font-bold text-gray-700 mb-2">{caja.nombre} <span className="text-xs font-normal text-gray-400">— {caja.descripcion}</span></p>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  {matsCaja.map((m, idx) => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between px-4 py-3 ${idx < matsCaja.length - 1 ? "border-b border-gray-100" : ""}`}
                    >
                      <span className={`text-sm ${m.necesita_restock ? "font-semibold text-red-600" : "text-gray-800"}`}>
                        {m.nombre}
                      </span>
                      <button
                        onClick={() => toggleMaterial(m.id, m.necesita_restock)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                          m.necesita_restock
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {m.necesita_restock ? <><AlertTriangle size={12} /> Falta</> : "OK"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "estudio" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Gestiona el stock del estudio. Marca lo que hay que comprar o producir.
          </p>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">Insumo</span>
              <span className="text-xs font-semibold text-gray-500 text-center">Cantidad</span>
              <span className="text-xs font-semibold text-gray-500">Estado</span>
            </div>
            {insumos.map((ins, idx) => (
              <div
                key={ins.id}
                className={`grid grid-cols-[1fr_80px_auto] gap-3 px-4 py-3 items-center ${idx < insumos.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <div>
                  <p className={`text-sm ${ins.necesita_compra ? "font-semibold text-red-600" : "text-gray-800"}`}>
                    {ins.nombre}
                  </p>
                  <p className="text-xs text-gray-400">{ins.unidad}</p>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  value={ins.cantidad}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => updateCantidad(ins.id, parseInt(e.target.value) || 0)}
                  className="w-full text-center text-sm border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-black"
                />
                <button
                  onClick={() => toggleInsumo(ins.id, ins.necesita_compra)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    ins.necesita_compra
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {ins.necesita_compra ? <><AlertTriangle size={12} /> Comprar</> : "OK"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón enviar email */}
      {totalAlertas > 0 && (
        <div className="sticky bottom-20 bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{totalAlertas} item{totalAlertas > 1 ? "s" : ""} pendiente{totalAlertas > 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-500">Envía la lista al equipo</p>
            </div>
            <button
              onClick={enviarEmail}
              disabled={sending}
              className="bg-black text-white px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 hover:bg-gray-900 transition-colors flex items-center gap-2"
            >
              {sending ? "Enviando..." : emailSent ? <><Check size={16} /> Enviado</> : <><Mail size={16} /> Enviar lista</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
