"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setSession, getSession } from "@/lib/auth";
import type { Usuario } from "@/lib/auth";
import { useLang } from "@/app/components/LangProvider";

// Solo id y nombre: el PIN cifrado ya no se descarga al navegador.
interface UsuarioLista {
  id: string;
  nombre: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLang();
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [selected, setSelected] = useState<UsuarioLista | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/");
      return;
    }
    // La lista de nombres viene de una ruta de servidor (sin PINs).
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((d) => setUsuarios(d.users ?? []))
      .catch(() => setUsuarios([]))
      .finally(() => setLoading(false));
  }, []);

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    setError("");
    setPin((p) => p + d);
  }

  function pressBack() {
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  async function tryLogin() {
    if (!selected || pin.length < 4 || verificando) return;
    setVerificando(true);
    setError("");
    try {
      // El PIN se verifica en el servidor; si es correcto devuelve la sesión.
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, pin }),
      });
      if (!res.ok) {
        setError(t.wrongPin);
        setPin("");
        setVerificando(false);
        return;
      }
      const data = await res.json();
      // Guardar la sesión segura de Supabase (habilita el acceso con RLS activo).
      const { error: sessErr } = await supabase.auth.setSession(data.session);
      if (sessErr) {
        setError(t.wrongPin);
        setPin("");
        setVerificando(false);
        return;
      }
      const user: Usuario = data.user;
      setSession(user);
      router.replace("/");
    } catch {
      setError(t.wrongPin);
      setPin("");
      setVerificando(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-20 bg-black flex items-center justify-center">
        <div className="text-gray-500 text-sm">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 bg-black flex flex-col items-center justify-center px-6 gap-8 overflow-y-auto">
      <div
        role="img"
        aria-label="Ohne Rotkohl"
        className="logo-tornasol h-10 w-72 max-w-[85vw]"
      />

      {!selected ? (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <p className="text-gray-400 text-sm text-center mb-1">{t.whoAreYou}</p>
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
              {t.changeUser}
            </button>
            <p className="text-white text-lg font-semibold">{selected.nombre}</p>
            <p className="text-gray-500 text-xs">{t.enterPin}</p>
          </div>

          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-colors ${
                  i < pin.length ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

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

          <button
            onClick={tryLogin}
            disabled={pin.length < 4 || verificando}
            className="w-full bg-white text-black rounded-2xl py-4 text-base font-semibold disabled:opacity-30 transition-opacity"
          >
            {verificando ? t.loading : t.enter}
          </button>
        </div>
      )}
    </div>
  );
}
