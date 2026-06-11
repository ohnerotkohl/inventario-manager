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
    const session = getSession();
    if (!session) {
      setLoading(false);
      if (!PUBLIC_PATHS.includes(pathname)) router.replace("/login");
      return;
    }

    // Refresca permisos desde Supabase en cada carga
    supabase
      .from("usuarios")
      .select("*")
      .eq("id", session.id)
      .single()
      .then(({ data }) => {
        if (!data || !data.activo) {
          clearSession();
          setUser(null);
          router.replace("/login");
        } else {
          const fresh: Usuario = {
            id: data.id,
            nombre: data.nombre,
            rol: data.rol,
            puede_inventario: data.puede_inventario,
            cajas_permitidas: data.cajas_permitidas ?? null,
          };
          setSession(fresh);
          setUser(fresh);
        }
        setLoading(false);
      });
  }, [pathname]);

  function logout() {
    clearSession();
    setUser(null);
    router.replace("/login");
  }

  if (loading) return null;

  if (!user && !PUBLIC_PATHS.includes(pathname)) return null;

  return <Ctx.Provider value={{ user, logout, loading }}>{children}</Ctx.Provider>;
}
