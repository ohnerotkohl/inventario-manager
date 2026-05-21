"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import type { Usuario } from "@/lib/auth";

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
    setUser(session);
    setLoading(false);
    if (!session && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login");
    }
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
