"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SkeletonCard, SkeletonList } from "@/app/components/Skeleton";

interface AlertCounts {
  out: number;
  stockBajo: number;
  sampleFalta: number;
  materiales: number;
  insumos: number;
}

interface CajaResumen {
  id: string;
  nombre: string;
  descripcion: string;
  outCount: number;
  stockBajoCount: number;
  sampleCount: number;
}

interface UltimaSesion {
  nombre: string;
  fecha: string;
  trabajador: string;
}

export default function Dashboard() {
  const [alertas, setAlertas] = useState<AlertCounts>({ out: 0, sampleFalta: 0, materiales: 0, insumos: 0 });
  const [cajas, setCajas] = useState<CajaResumen[]>([]);
  const [ultimasSesiones, setUltimasSesiones] = useState<UltimaSesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url === "your_supabase_url_here") {
      setConfigured(false);
      setLoading(false);
      return;
    }
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [invRes, matRes, insRes, cajasRes, sesRes] = await Promise.all([
        supabase.from("inventario").select("out, sample_falta, caja_id, cantidad"),
        supabase.from("materiales_caja").select("necesita_restock").eq("necesita_restock", true),
        supabase.from("insumos_estudio").select("necesita_compra").eq("necesita_compra", true),
        supabase.from("cajas").select("id, nombre, descripcion"),
        supabase.from("sesiones").select("fecha, trabajador, mercados(nombre)").order("created_at", { ascending: false }).limit(5),
      ]);

      const inv = invRes.data || [];
      setAlertas({
        out: inv.filter((i) => i.out).length,
        stockBajo: inv.filter((i) => !i.out && i.cantidad > 0 && i.cantidad < 3).length,
        sampleFalta: inv.filter((i) => i.sample_falta).length,
        materiales: matRes.data?.length || 0,
        insumos: insRes.data?.length || 0,
      });

      const cajasData = cajasRes.data || [];
      setCajas(cajasData.map((c) => {
        const cajaInv = inv.filter((i) => i.caja_id === c.id);
        return {
          ...c,
          outCount: cajaInv.filter((i) => i.out).length,
          stockBajoCount: cajaInv.filter((i) => !i.out && i.cantidad > 0 && i.cantidad < 3).length,
          sampleCount: cajaInv.filter((i) => i.sample_falta).length,
        };
      }));

      type SesionRow = { fecha: string; trabajador: string; mercados: { nombre: string } | null };
      setUltimasSesiones(
        (sesRes.data as unknown as SesionRow[] || []).map((s) => ({
          nombre: s.mercados?.nombre || "—",
          fecha: s.fecha,
          trabajador: s.trabajador,
        }))
      );
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-5xl">⚙️</div>
        <h2 className="text-xl font-bold">Conecta Supabase</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          La app está lista pero necesita conectarse a la base de datos.
        </p>
        <div className="bg-gray-100 rounded-xl p-4 text-left text-sm w-full max-w-sm space-y-1">
          <p className="text-gray-700">1. Crea proyecto en supabase.com</p>
          <p className="text-gray-700">2. Copia la URL y Anon Key</p>
          <p className="text-gray-700">3. Pégalos en el archivo .env.local</p>
          <p className="text-gray-700">4. Ejecuta supabase-schema.sql en Supabase</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-gray-200 rounded-lg w-36" />
          <div className="h-4 bg-gray-100 rounded-lg w-52" />
        </div>
        <SkeletonCard />
        <div className="h-14 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  const totalAlertas = alertas.out + alertas.stockBajo + alertas.sampleFalta + alertas.materiales + alertas.insumos;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Resumen de Ohne Rotkohl</p>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="font-semibold text-red-700 mb-3">⚠️ {totalAlertas} alertas activas</p>
          <div className="grid grid-cols-2 gap-2">
            {alertas.out > 0 && (
              <div className="bg-red-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{alertas.out}</p>
                <p className="text-xs text-red-700">Sold Out</p>
              </div>
            )}
            {alertas.stockBajo > 0 && (
              <div className="bg-yellow-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{alertas.stockBajo}</p>
                <p className="text-xs text-yellow-700">Stock bajo (menos de 3)</p>
              </div>
            )}
            {alertas.sampleFalta > 0 && (
              <div className="bg-orange-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{alertas.sampleFalta}</p>
                <p className="text-xs text-orange-700">Samples faltan</p>
              </div>
            )}
            {alertas.materiales > 0 && (
              <div className="bg-yellow-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{alertas.materiales}</p>
                <p className="text-xs text-yellow-700">Materiales caja</p>
              </div>
            )}
            {alertas.insumos > 0 && (
              <div className="bg-blue-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{alertas.insumos}</p>
                <p className="text-xs text-blue-700">Insumos estudio</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 font-semibold">✅ Todo en orden</p>
          <p className="text-green-600 text-sm">Sin alertas activas</p>
        </div>
      )}

      {/* Acción rápida */}
      <Link
        href="/sesion"
        className="flex items-center justify-center gap-3 bg-black text-white rounded-2xl p-4 font-semibold text-lg hover:bg-gray-900 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        Registrar sesión de mercado
      </Link>

      {/* Estado de cajas */}
      <div>
        <h2 className="font-bold text-gray-700 mb-3">Estado de cajas</h2>
        <div className="grid grid-cols-2 gap-3">
          {cajas.map((c) => (
            <Link key={c.id} href={`/inventario?caja=${c.nombre.replace(/ /g, '-')}`}>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-400 transition-colors">
                <p className="font-bold text-gray-900">{c.nombre}</p>
                <p className="text-xs text-gray-500 mb-3 leading-tight">{c.descripcion}</p>
                {c.outCount > 0 && <p className="text-xs text-red-600">🔴 {c.outCount} sold out</p>}
                {c.stockBajoCount > 0 && <p className="text-xs text-yellow-600">🟡 {c.stockBajoCount} stock bajo</p>}
                {c.sampleCount > 0 && <p className="text-xs text-orange-600">🟠 {c.sampleCount} samples faltan</p>}
                {c.outCount === 0 && c.stockBajoCount === 0 && c.sampleCount === 0 && <p className="text-xs text-green-600">✅ OK</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Últimas sesiones */}
      {ultimasSesiones.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-700 mb-3">Últimas sesiones</h2>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
            {ultimasSesiones.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm text-gray-900">{s.nombre}</p>
                  <p className="text-xs text-gray-500">{s.trabajador}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(s.fecha).toLocaleDateString("es-DE", { day: "2-digit", month: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
