"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { translations, tr, LANG_KEY, type Lang } from "@/lib/i18n";

interface LangCtxType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof translations.es;
  tr: (key: keyof typeof translations.es, vars?: Record<string, string | number>) => string;
}

const LangCtx = createContext<LangCtxType>({
  lang: "es",
  setLang: () => {},
  t: translations.es,
  tr: (key) => translations.es[key] as string,
});

export function useLang() {
  return useContext(LangCtx);
}

export default function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved === "es" || saved === "en") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }

  const t = translations[lang];

  return (
    <LangCtx.Provider value={{ lang, setLang, t, tr: (key, vars) => tr(t, key, vars) }}>
      {children}
    </LangCtx.Provider>
  );
}
