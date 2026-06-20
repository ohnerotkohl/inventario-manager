"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";
import { SkeletonPage } from "@/app/components/Skeleton";

interface Novedad {
  id: string;
  titulo: string;
  descripcion: string | null;
  pedido_por: string | null;
  notificada: boolean;
  created_at: string;
}

const VISTA_KEY = "or_novedades_vista";

export default function NovedadesPage() {
  const { t, tr } = useLang();
  const router = useRouter();
  const { user } = useAuth();
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaVista, setUltimaVista] = useState<string>("");

  const [formAbierto, setFormAbierto] = useState(false);
  const [fTitulo, setFTitulo] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fPedido, setFPedido] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [notificando, setNotificando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (user?.rol === "empleado") { router.replace("/sesion"); return; }
    setUltimaVista(localStorage.getItem(VISTA_KEY) || "");
    fetchData();
  }, [user]);

  async function fetchData() {
    const { data } = await supabase.from("novedades").select("*").order("created_at", { ascending: false });
    setNovedades((data as Novedad[]) || []);
    setLoading(false);
    // Marca esta visita para los badges "nuevo" de la próxima vez
    localStorage.setItem(VISTA_KEY, new Date().toISOString());
  }

  if (loading) return <SkeletonPage />;
  if (user?.rol === "empleado") return null;

  async function guardarNovedad() {
    if (!fTitulo.trim() || guardando) return;
    setGuardando(true);
    const { error } = await supabase.from("novedades").insert({
      titulo: fTitulo.trim(),
      descripcion: fDesc.trim() || null,
      pedido_por: fPedido.trim() || null,
    });
    setGuardando(false);
    if (error) { alert(t.saveError); return; }
    setFTitulo(""); setFDesc(""); setFPedido("");
    setFormAbierto(false);
    fetchData();
  }

  async function eliminarNovedad(id: string) {
    if (!confirm(t.deleteNewsConfirm)) return;
    await supabase.from("novedades").delete().eq("id", id);
    setNovedades((prev) => prev.filter((n) => n.id !== id));
  }

  const sinNotificar = novedades.filter((n) => !n.notificada);

  async function notificar() {
    if (sinNotificar.length === 0 || notificando) return;
    setNotificando(true);
    try {
      const res = await fetch("/api/email/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          novedades: sinNotificar.map((n) => ({ titulo: n.titulo, descripcion: n.descripcion, pedido_por: n.pedido_por })),
        }),
      });
      if (!res.ok) throw new Error("fail");
      await supabase.from("novedades").update({ notificada: true }).in("id", sinNotificar.map((n) => n.id));
      setAviso(t.notifiedOk);
      setTimeout(() => setAviso(""), 4000);
      fetchData();
    } catch {
      setAviso(t.shiftEmailFailed);
      setTimeout(() => setAviso(""), 4000);
    }
    setNotificando(false);
  }

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-black";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.newsTitle}</h1>
        <p className="text-gray-500 text-sm">{t.newsSubtitle}</p>
      </div>

      {aviso && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3">{aviso}</div>}

      {/* Añadir novedad */}
      {formAbierto ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <input type="text" value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder={t.newsTitlePh} className={inputClass} autoFocus />
          <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={t.newsDescPh} rows={2} className={`${inputClass} resize-none`} />
          <input type="text" value={fPedido} onChange={(e) => setFPedido(e.target.value)} placeholder={t.newsRequestedBy} className={inputClass} />
          <div className="flex gap-2">
            <button onClick={guardarNovedad} disabled={!fTitulo.trim() || guardando} className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400">
              {guardando ? t.saving : t.saveNews}
            </button>
            <button onClick={() => setFormAbierto(false)} className="px-4 text-sm text-gray-400">{t.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setFormAbierto(true)} className="flex-1 text-left text-sm text-gray-400 border border-dashed border-gray-300 rounded-xl px-4 py-3 hover:border-black hover:text-black transition-colors">
            {t.addNews}
          </button>
          {sinNotificar.length > 0 && (
            <button onClick={notificar} disabled={notificando} className="shrink-0 bg-black text-white text-sm font-medium rounded-xl px-4 py-3 disabled:opacity-50">
              {notificando ? t.notifying : t.notifyTeam}
            </button>
          )}
        </div>
      )}

      {sinNotificar.length > 0 && !formAbierto && (
        <p className="text-xs text-gray-400 -mt-3">{tr("pendingNotify", { n: sinNotificar.length })}</p>
      )}

      {/* Lista */}
      {novedades.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t.noNews}</p>
      ) : (
        <div className="space-y-2">
          {novedades.map((n) => {
            const esNueva = ultimaVista && n.created_at > ultimaVista;
            return (
              <div key={n.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {esNueva && <span className="texto-tornasol font-bold mr-1.5">{t.newBadge}</span>}
                      {n.titulo}
                    </p>
                    {n.descripcion && <p className="text-xs text-gray-500 mt-0.5">{n.descripcion}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {n.created_at.slice(0, 10)}{n.pedido_por ? ` · ${n.pedido_por}` : ""}{!n.notificada ? " · sin notificar" : ""}
                    </p>
                  </div>
                  <button onClick={() => eliminarNovedad(n.id)} className="shrink-0 text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
