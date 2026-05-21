"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hashPin, setSession, getSession } from "@/lib/auth";
import type { Usuario } from "@/lib/auth";

interface UsuarioRow {
  id: string;
  nombre: string;
  pin_hash: string;
  rol: "admin" | "empleado";
  puede_inventario: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [selected, setSelected] = useState<UsuarioRow | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/");
      return;
    }
    supabase
      .from("usuarios")
      .select("id, nombre, pin_hash, rol, puede_inventario")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        setUsuarios(data ?? []);
        setLoading(false);
      });
  }, []);

  function pressDigit(d: string) {
    if (pin.length >= 6) return;
    setError("");
    setPin((p) => p + d);
  }

  function pressBack() {
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  async function tryLogin() {
    if (!selected || pin.length < 4) return;
    const hashed = await hashPin(pin);
    if (hashed !== selected.pin_hash) {
      setError("PIN incorrecto");
      setPin("");
      return;
    }
    const user: Usuario = {
      id: selected.id,
      nombre: selected.nombre,
      rol: selected.rol,
      puede_inventario: selected.puede_inventario,
    };
    setSession(user);
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-500 text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-8">
      <img
        src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-Blanco.png?v=1776366740"
        alt="Ohne Rotkohl"
        className="h-8"
      />

      {!selected ? (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <p className="text-gray-400 text-sm text-center mb-1">¿Quién eres?</p>
          {usuarios.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-2xl py-4 text-base font-medium transition-colors"
            >
              {u.nombre}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-xs flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => { setSelected(null); setPin(""); setError(""); }}
              className="text-gray-400 text-xs hover:text-white transition-colors"
            >
              ← Cambiar usuario
            </button>
            <p className="text-white text-lg font-semibold">{selected.nombre}</p>
            <p className="text-gray-500 text-xs">Introduce tu PIN</p>
          </div>

          {/* PIN dots — hasta 6 */}
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i < pin.length ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, i) => {
              if (key === "") return <div key={i} />;
              return (
                <button
                  key={key}
                  onClick={() => key === "⌫" ? pressBack() : pressDigit(key)}
                  className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-2xl font-light rounded-2xl py-5 transition-colors"
                >
                  {key}
                </button>
              );
            })}
          </div>

          {/* Botón confirmar */}
          <button
            onClick={tryLogin}
            disabled={pin.length < 4}
            className="w-full bg-white text-black rounded-2xl py-4 text-base font-semibold disabled:opacity-30 transition-opacity"
          >
            Entrar →
          </button>
        </div>
      )}
    </div>
  );
}
