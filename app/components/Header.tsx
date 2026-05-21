"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isLogin = pathname === "/login" || pathname === "/setup";

  return (
    <header className="bg-black px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <img
        src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-Blanco.png?v=1776366740"
        alt="Ohne Rotkohl"
        className="h-7"
      />
      {!isLogin && user ? (
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          {user.nombre}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      ) : (
        <span className="text-xs text-gray-400 uppercase tracking-widest">Inventario Manager</span>
      )}
    </header>
  );
}
