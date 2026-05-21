"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth";

export default function SetupPage() {
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function crear() {
    setError("");
    if (!nombre.trim()) { setError("Escribe un nombre."); return; }
    if (pin.length < 4) { setError("El PIN debe tener al menos 4 dígitos."); return; }
    if (!/^\d+$/.test(pin)) { setError("El PIN solo puede tener números."); return; }
    if (pin !== confirmar) { setError("Los PINs no coinciden."); return; }

    setSaving(true);
    const pin_hash = await hashPin(pin);
    const { error: err } = await supabase.from("usuarios").insert({
      nombre: nombre.trim(),
      pin_hash,
      rol: "admin",
      puede_inventario: true,
      activo: true,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-6">
        <img
          src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-Blanco.png?v=1776366740"
          alt="Ohne Rotkohl"
          className="h-8"
        />
        <div className="bg-white/10 rounded-2xl p-6 text-center max-w-xs w-full flex flex-col gap-3">
          <p className="text-3xl">✓</p>
          <p className="text-white font-semibold text-lg">Usuario creado</p>
          <p className="text-gray-400 text-sm">
            Ya puedes ir a <strong className="text-white">/login</strong> e iniciar sesión con tu PIN.
            Desde ahí podrás crear a los demás usuarios en <strong className="text-white">/admin</strong>.
          </p>
          <a
            href="/login"
            className="mt-2 bg-white text-black rounded-xl py-3 text-sm font-semibold"
          >
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-6">
      <img
        src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-Blanco.png?v=1776366740"
        alt="Ohne Rotkohl"
        className="h-8"
      />
      <div className="w-full max-w-xs flex flex-col gap-4">
        <div className="text-center">
          <p className="text-white font-semibold text-lg">Crear primer admin</p>
          <p className="text-gray-400 text-xs mt-1">Solo para la configuración inicial</p>
        </div>

        <input
          className="bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-white"
          placeholder="Tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          className="bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-white"
          placeholder="PIN (mínimo 4 dígitos)"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <input
          className="bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-white"
          placeholder="Confirmar PIN"
          type="password"
          inputMode="numeric"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={crear}
          disabled={saving}
          className="bg-white text-black rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear usuario admin"}
        </button>
      </div>
    </div>
  );
}
