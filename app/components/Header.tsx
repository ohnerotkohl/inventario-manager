"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";
import FeedbackWidget from "./FeedbackWidget";

export default function Header() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const isPublic = pathname === "/login" || pathname === "/setup";

  // El login es negro minimalista: sin header, sin logos repetidos
  if (pathname === "/login") return null;

  return (
    <header className="bg-[#0b0c0f] border-b border-white/[.07] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] flex items-center justify-between sticky top-0 z-10">
      <img
        src="https://cdn.shopify.com/s/files/1/0955/8471/5077/files/logo-Blanco.png?v=1776366740"
        alt="Ohne Rotkohl"
        className="h-7"
      />
      <div className="flex items-center gap-2">
        {/* Feedback de la beta */}
        {!isPublic && <FeedbackWidget />}
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "es" ? "en" : "es")}
          className="flex items-center bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[10px] font-bold tracking-widest px-2 py-[3px] rounded-md transition-all"
        >
          {lang === "es" ? "EN" : "ES"}
        </button>

        {!isPublic && user && (
          <>
            {/* Solo la inicial de quien ha entrado, para que el logo respire */}
            <span
              title={user.nombre}
              aria-label={user.nombre}
              className="ml-1 w-[26px] h-[26px] rounded-full grid place-items-center text-[11px] font-semibold text-white bg-gradient-to-br from-[#8b7cf0] to-[#4a32a0] ring-1 ring-white/15"
            >
              {user.nombre.trim().charAt(0).toUpperCase()}
            </span>
            <button
              onClick={logout}
              title="Salir"
              aria-label="Salir"
              className="w-[26px] h-[26px] grid place-items-center rounded-full text-[#8b909c] hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
