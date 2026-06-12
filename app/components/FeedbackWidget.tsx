"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";

// Reconocimiento de voz del navegador (Chrome/Android y Safari/iOS)
type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function crearReconocedor(): Reconocedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

// Idiomas del equipo para el dictado (el reconocedor necesita saber
// qué idioma va a escuchar; el del teléfono no siempre coincide)
const IDIOMAS_DICTADO = [
  { code: "es-ES", label: "ES" },
  { code: "en-US", label: "EN" },
  { code: "de-DE", label: "DE" },
  { code: "hi-IN", label: "HI" },
  { code: "it-IT", label: "IT" },
  { code: "ca-ES", label: "CA" },
];

const DICTADO_LANG_KEY = "or_dictado_lang";

function idiomaInicial(): string {
  const guardado = typeof window !== "undefined" ? localStorage.getItem(DICTADO_LANG_KEY) : null;
  if (guardado && IDIOMAS_DICTADO.some((i) => i.code === guardado)) return guardado;
  const navegador = (typeof navigator !== "undefined" ? navigator.language : "es") || "es";
  const match = IDIOMAS_DICTADO.find((i) => i.code.slice(0, 2) === navegador.slice(0, 2).toLowerCase());
  return match?.code || "es-ES";
}

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [soportaVoz, setSoportaVoz] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [idiomaDictado, setIdiomaDictado] = useState(idiomaInicial);
  const reconocedorRef = useRef<Reconocedor | null>(null);
  // Safari a veces solo entrega resultados provisionales: los guardamos
  // para no perder el dictado al parar
  const provisionalRef = useRef("");

  useEffect(() => {
    setSoportaVoz(crearReconocedor() !== null);
  }, []);

  if (!user) return null;
  const esAdmin = user.rol === "admin";

  function anadirDictado(dictado: string) {
    if (!dictado.trim()) return;
    setTexto((prev) => (prev ? prev.trimEnd() + " " : "") + dictado.trim());
  }

  function pararMicrofono() {
    // No dependemos del navegador para apagar el estado: Safari a veces
    // nunca dispara onend después de stop()
    setGrabando(false);
    if (provisionalRef.current.trim()) {
      anadirDictado(provisionalRef.current);
      provisionalRef.current = "";
    }
    const rec = reconocedorRef.current;
    reconocedorRef.current = null;
    try { rec?.stop(); } catch { /* ya parado */ }
    try { rec?.abort(); } catch { /* no soportado */ }
  }

  function toggleMicrofono() {
    if (grabando) {
      pararMicrofono();
      return;
    }
    const rec = crearReconocedor();
    if (!rec) return;
    // El idioma que la persona eligió junto al micrófono
    rec.lang = idiomaDictado;
    rec.continuous = true;
    rec.interimResults = true;
    provisionalRef.current = "";
    rec.onresult = (e) => {
      let definitivo = "";
      let provisional = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const trozo = e.results[i][0].transcript;
        if (e.results[i].isFinal) definitivo += trozo;
        else provisional += trozo;
      }
      if (definitivo.trim()) {
        anadirDictado(definitivo);
        provisionalRef.current = "";
      } else {
        provisionalRef.current = provisional;
      }
    };
    rec.onend = () => {
      if (reconocedorRef.current === rec) pararMicrofono();
    };
    rec.onerror = () => {
      if (reconocedorRef.current === rec) pararMicrofono();
    };
    reconocedorRef.current = rec;
    try {
      rec.start();
      setGrabando(true);
    } catch { /* micrófono no disponible */ }
  }

  async function abrir() {
    setAbierto(true);
    setGracias(false);
    const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(30);
    const todos = (data as Feedback[]) || [];
    // Una sola lista: los admins ven todo, los empleados solo lo suyo
    setLista(esAdmin ? todos : todos.filter((f) => f.usuario_nombre === user?.nombre));
  }

  async function enviar() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const { error } = editandoId
      ? await supabase.from("feedback").update({ texto: texto.trim() }).eq("id", editandoId)
      : await supabase.from("feedback").insert({
          usuario_nombre: user?.nombre || "—",
          texto: texto.trim(),
          pagina: pathname,
        });
    setEnviando(false);
    if (error) return;
    setTexto("");
    setEditandoId(null);
    setGracias(true);
    abrir();
  }

  function editarMio(f: Feedback) {
    setTexto(f.texto);
    setEditandoId(f.id);
    setGracias(false);
  }

  function cancelarEdicion() {
    setTexto("");
    setEditandoId(null);
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
        <svg className="icono-tornasol" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <span className="texto-tornasol">BETA</span>
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
            {grabando && <p className="text-xs text-red-600 animate-pulse">● {t.listening}</p>}
            {editandoId && (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-purple-700">{t.editingFeedback}</span>
                <button onClick={cancelarEdicion} className="text-[11px] text-gray-400 underline">{t.cancel}</button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={enviar}
                disabled={!texto.trim() || enviando}
                className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400"
              >
                {enviando ? t.sending : editandoId ? t.saveChanges : t.feedbackSend}
              </button>
              {soportaVoz && (
                <select
                  value={idiomaDictado}
                  onChange={(e) => {
                    setIdiomaDictado(e.target.value);
                    localStorage.setItem(DICTADO_LANG_KEY, e.target.value);
                  }}
                  disabled={grabando}
                  title={t.dictateIn}
                  className="shrink-0 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl px-2 focus:outline-none disabled:opacity-50"
                >
                  {IDIOMAS_DICTADO.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
                </select>
              )}
              {soportaVoz && (
                <button
                  onClick={toggleMicrofono}
                  title={grabando ? t.listening : t.dictate}
                  className={`shrink-0 w-11 rounded-xl flex items-center justify-center transition-colors ${
                    grabando ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </button>
              )}
            </div>
            {gracias && <p className="text-sm text-emerald-600 text-center">✓ {t.feedbackThanks}</p>}

            {lista.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {esAdmin ? t.feedbackListTitle : t.myFeedbacks}
                </p>
                {lista.map((f) => (
                  <div key={f.id} className={`rounded-lg px-3 py-2 flex justify-between gap-2 ${editandoId === f.id ? "bg-purple-50 border border-purple-200" : "bg-gray-50"}`}>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 whitespace-pre-wrap">{f.texto}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {f.usuario_nombre} · {f.created_at.slice(0, 10)}{f.pagina ? ` · ${f.pagina}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-start gap-1.5">
                      <button onClick={() => editarMio(f)} title={t.edit} className="text-gray-300 hover:text-black p-0.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>
                        </svg>
                      </button>
                      {esAdmin && (
                        <button onClick={() => eliminar(f.id)} className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                      )}
                    </div>
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
