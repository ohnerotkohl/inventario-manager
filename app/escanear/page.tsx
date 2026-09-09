"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// PRUEBA de la pantalla de escaneo. Página oculta (no está en el menú).
// Lee los QR de la hoja con la cámara del móvil y va contando lo escaneado.
// Formato de los códigos: OR|<posterId|COMBO>|<talla>

interface P { id: string; nombre: string }

export default function EscanearPruebaPage() {
  const [posters, setPosters] = useState<Record<string, string>>({}); // id -> nombre
  const [counts, setCounts] = useState<Record<string, number>>({});   // `${id}-A4` -> n
  const [combos, setCombos] = useState<{ A4: number; A3: number }>({ A4: 0, A3: 0 });
  const [msg, setMsg] = useState<{ txt: string; combo?: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [leyendo, setLeyendo] = useState(false); // armado: esperando leer tras tocar
  const [error, setError] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  // Solo se cuenta un escaneo si el usuario ha tocado la pantalla (captura manual).
  // armedUntil = momento hasta el que una lectura vale tras el toque.
  const armedUntilRef = useRef<number>(0);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.from("posters").select("id, nombre").eq("activo", true).then(({ data }) => {
      const map: Record<string, string> = {};
      for (const p of ((data as P[]) || [])) map[p.id] = p.nombre;
      setPosters(map);
    });
  }, []);

  // Toca la pantalla para "armar" una lectura. La próxima decodificación (en
  // ~1,6s) cuenta y se desarma. Sin tocar, la cámara ve el código pero no cuenta.
  function armar() {
    if (!scanning) return;
    armedUntilRef.current = Date.now() + 1600;
    setLeyendo(true);
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    armTimerRef.current = setTimeout(() => {
      if (Date.now() >= armedUntilRef.current) { setLeyendo(false); flash("No se leyó ningún código, vuelve a tocar", false, false); }
    }, 1600);
  }

  function handleCode(text: string) {
    // Solo cuenta si el usuario acaba de tocar la pantalla (captura manual)
    if (Date.now() > armedUntilRef.current) return;
    armedUntilRef.current = 0; // desarmar: un toque = una lectura
    setLeyendo(false);

    const parts = text.split("|");
    if (parts[0] !== "OR" || parts.length < 3) { flash("Código no reconocido", false, true); return; }
    const talla = parts[2] === "A4" ? "A4" : parts[2] === "A3" ? "A3" : null;
    if (!talla) { flash("Talla no válida", false, true); return; }

    if (parts[1] === "COMBO") {
      setCombos((c) => ({ ...c, [talla]: c[talla] + 1 }));
      flash(`Combo ${talla} marcado`, true);
      navigator.vibrate?.(60);
      return;
    }
    const id = parts[1];
    const nombre = posters[id];
    if (!nombre) { flash("Póster no encontrado", false, true); return; }
    setCounts((c) => ({ ...c, [`${id}-${talla}`]: (c[`${id}-${talla}`] || 0) + 1 }));
    flash(`${nombre} · ${talla} +1`);
    navigator.vibrate?.(40);
  }

  function flash(txt: string, combo = false, err = false) {
    setMsg({ txt, combo });
    if (err) setError(txt);
    setTimeout(() => setMsg((m) => (m?.txt === txt ? null : m)), 1200);
  }

  async function iniciar() {
    setError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => handleCode(decoded),
        () => {}
      );
      setScanning(true);
    } catch (e) {
      setError("No se pudo abrir la cámara: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function parar() {
    try { await scannerRef.current?.stop(); } catch { /* ya parado */ }
    armedUntilRef.current = 0;
    setLeyendo(false);
    setScanning(false);
  }

  useEffect(() => () => {
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    scannerRef.current?.stop().catch(() => {});
  }, []);

  const filas = Object.entries(
    Object.entries(counts).reduce((acc, [key, n]) => {
      const talla = key.slice(-2);
      const id = key.slice(0, -3);
      acc[id] = acc[id] || { A4: 0, A3: 0 };
      (acc[id] as Record<string, number>)[talla] = n;
      return acc;
    }, {} as Record<string, { A4: number; A3: number }>)
  );
  const totalA4 = Object.entries(counts).filter(([k]) => k.endsWith("A4")).reduce((a, [, n]) => a + n, 0);
  const totalA3 = Object.entries(counts).filter(([k]) => k.endsWith("A3")).reduce((a, [, n]) => a + n, 0);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escaneo (prueba)</h1>
        <p className="text-gray-500 text-sm">Apunta al código y <strong>toca la pantalla</strong> encima de él para leerlo. Combo: lee los 3 pósters y luego el código de combo.</p>
      </div>

      <div className="relative w-full rounded-2xl overflow-hidden bg-black min-h-[240px]" onClick={armar}>
        <div id="reader" className="w-full" />
        {scanning && (
          <div className={`pointer-events-none absolute inset-0 flex items-end justify-center pb-3 transition-colors ${leyendo ? "ring-4 ring-green-400 ring-inset" : ""}`}>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${leyendo ? "bg-green-500 text-white" : "bg-black/60 text-white"}`}>
              {leyendo ? "Leyendo..." : "Toca aquí sobre el código"}
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-center font-semibold ${msg.combo ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>
          {msg.txt}
        </div>
      )}

      <div className="flex gap-2">
        {!scanning
          ? <button onClick={iniciar} className="flex-1 bg-black text-white rounded-2xl py-3 font-semibold">Iniciar cámara</button>
          : <button onClick={parar} className="flex-1 bg-gray-200 text-gray-800 rounded-2xl py-3 font-semibold">Parar</button>}
      </div>

      {/* Conteo en vivo */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-700">Escaneado</p>
          <p className="text-xs font-medium">
            <span className="text-yellow-600">A4: {totalA4}</span>
            <span className="text-gray-300"> · </span>
            <span className="text-blue-600">A3: {totalA3}</span>
            {(combos.A4 > 0 || combos.A3 > 0) && <span className="text-purple-600"> · Combos {combos.A4}/{combos.A3}</span>}
          </p>
        </div>
        {filas.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aún no has escaneado nada.</p>
        ) : (
          <div className="grid grid-cols-[1fr_40px_40px] gap-x-3 gap-y-1.5">
            <span className="text-xs font-semibold text-gray-400">Póster</span>
            <span className="text-xs font-semibold text-gray-400 text-center">A4</span>
            <span className="text-xs font-semibold text-gray-400 text-center">A3</span>
            {filas.map(([id, v]) => (
              <div key={id} className="contents">
                <span className="text-sm text-gray-800">{posters[id] || "—"}</span>
                <span className="text-sm font-semibold text-center text-gray-900">{v.A4 || "—"}</span>
                <span className="text-sm font-semibold text-center text-gray-900">{v.A3 || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
