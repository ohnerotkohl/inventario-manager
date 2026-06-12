"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";

interface Feedback {
  id: string;
  usuario_nombre: string;
  texto: string;
  pagina: string | null;
  created_at: string;
}

export default function FeedbackWidget() {
  const { user } = useAuth();
  const { t } = useLang();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gracias, setGracias] = useState(false);
  const [lista, setLista] = useState<Feedback[]>([]);

  if (!user) return null;
  const esAdmin = user.rol === "admin";

  async function abrir() {
    setAbierto(true);
    setGracias(false);
    if (esAdmin) {
      const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(30);
      setLista((data as Feedback[]) || []);
    }
  }

  async function enviar() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const { error } = await supabase.from("feedback").insert({
      usuario_nombre: user?.nombre || "—",
      texto: texto.trim(),
      pagina: pathname,
    });
    setEnviando(false);
    if (error) return;
    setTexto("");
    setGracias(true);
    if (esAdmin) abrir();
  }

  async function eliminar(id: string) {
    if (!confirm(t.deleteFeedbackConfirm)) return;
    await supabase.from("feedback").delete().eq("id", id);
    setLista((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <>
      <button
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        title={t.feedbackTitle}
        className="flex items-center gap-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        BETA
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="fixed top-14 left-2 right-2 sm:left-auto sm:right-4 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <p className="text-sm font-bold text-gray-900">{t.feedbackTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.feedbackHint}</p>
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t.feedbackPlaceholder}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black resize-none"
            />
            <button
              onClick={enviar}
              disabled={!texto.trim() || enviando}
              className="w-full py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              {enviando ? t.sending : t.feedbackSend}
            </button>
            {gracias && <p className="text-sm text-emerald-600 text-center">✓ {t.feedbackThanks}</p>}

            {esAdmin && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.feedbackListTitle}</p>
                {lista.length === 0 && <p className="text-xs text-gray-400">{t.feedbackEmptyList}</p>}
                {lista.map((f) => (
                  <div key={f.id} className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 whitespace-pre-wrap">{f.texto}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {f.usuario_nombre} · {f.created_at.slice(0, 10)}{f.pagina ? ` · ${f.pagina}` : ""}
                      </p>
                    </div>
                    <button onClick={() => eliminar(f.id)} className="shrink-0 text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
