"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { hashPin } from "@/lib/auth";
import { useLang } from "@/app/components/LangProvider";

export default function SetupPage() {
  const { t } = useLang();
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function crear() {
    setError("");
    if (!nombre.trim()) { setError(t.nameRequired); return; }
    if (pin.length !== 4) { setError(t.pinMustBe4); return; }
    if (!/^\d+$/.test(pin)) { setError(t.pinNumericOnly); return; }
    if (pin !== confirmar) { setError(t.pinsNoMatch); return; }

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
          <p className="text-white font-semibold text-lg">{t.userCreated}</p>
          <p className="text-gray-400 text-sm">{t.userCreatedDesc}</p>
          <a
            href="/login"
            className="mt-2 bg-white text-black rounded-xl py-3 text-sm font-semibold"
          >
            {t.goToLogin}
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
          <p className="text-white font-semibold text-lg">{t.createFirstAdmin}</p>
          <p className="text-gray-400 text-xs mt-1">{t.initialSetupOnly}</p>
        </div>

        <input
          className="bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-white"
          placeholder={t.yourName}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          className="bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-white"
          placeholder={t.pin4digits}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <input
          className="bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-white"
          placeholder={t.confirmPin}
          type="password"
          inputMode="numeric"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={crear}
          disabled={saving}
          className="bg-white text-black rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t.creating : t.createAdminUser}
        </button>
      </div>
    </div>
  );
}
