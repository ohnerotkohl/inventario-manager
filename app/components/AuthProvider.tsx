"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, setSession, clearSession } from "@/lib/auth";
import type { Usuario } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface AuthCtx {
  user: Usuario | null;
  logout: () => void;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, logout: () => {}, loading: true });

export function useAuth() {
  return useContext(Ctx);
}

const PUBLIC_PATHS = ["/login", "/setup"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const local = getSession();
      if (!local) {
        if (cancelado) return;
        setLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) router.replace("/login");
        return;
      }

      // Exigir la sesión segura de Supabase: sin ella (expirada/borrada) los
      // datos no cargarían con RLS activo, así que forzamos volver a entrar.
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        clearSession();
        if (cancelado) return;
        setUser(null);
        setLoading(false);
        if (!PUBLIC_PATHS.includes(pathname)) router.replace("/login");
        return;
      }

      // Revalidar que el usuario sigue activo. Envuelto para no dejar la app en
      // blanco para siempre si la consulta falla (antes .then sin catch colgaba).
      try {
        const { data, error } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", local.id)
          .maybeSingle();
        if (cancelado) return;
        if (error) {
          // Fallo transitorio de red: mantener la sesión local, no expulsar.
          setUser(local);
          setLoading(false);
          return;
        }
        if (!data || !data.activo) {
          clearSession();
          setUser(null);
          setLoading(false);
          if (!PUBLIC_PATHS.includes(pathname)) router.replace("/login");
          return;
        }
        const fresh: Usuario = {
          id: data.id,
          nombre: data.nombre,
          rol: data.rol,
          puede_inventario: data.puede_inventario,
          cajas_permitidas: data.cajas_permitidas ?? null,
        };
        setSession(fresh);
        setUser(fresh);
        setLoading(false);
      } catch {
        if (cancelado) return;
        setUser(local);
        setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    clearSession();
    setUser(null);
    router.replace("/login");
  }

  if (loading) return null;

  if (!user && !PUBLIC_PATHS.includes(pathname)) return null;

  return <Ctx.Provider value={{ user, logout, loading }}>{children}</Ctx.Provider>;
}
