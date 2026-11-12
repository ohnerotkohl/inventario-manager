"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/components/AuthProvider";
import { useLang } from "@/app/components/LangProvider";

// Pedidos de Shopify para imprimir (solo Marcello). Los pendientes se leen de
// Shopify en vivo; al marcar "impreso" pasan al historial (tabla
// pedidos_impresos), desde donde se puede volver a descargar el PDF.
// Solo A4 y A3 van al PDF; A2, A1 y lo enmarcado se muestran aparte.

type ArticuloShopify = { producto: string; variante: string; cantidad: number };
type PedidoShopify = { id: string; numero: string; fecha: string; nombre: string; articulos: ArticuloShopify[] };
type PosterMin = { id: string; nombre: string };
type ArticuloImpreso = { nombre: string; talla: "A4" | "A3"; cantidad: number };
type Impreso = { shopify_id: string; numero: string; fecha: string | null; cliente: string | null; articulos: ArticuloImpreso[]; impreso_at: string };

// "MIT KARTE BITTE POSTER" y "Mit Karte Bitte" → "mit karte bitte"; "09 Bowie BH" → "bowie bh"
function normalizar(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/poster/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^\d+\s+/, "");
}

// Talla imprimible en el taller: A4 o A3 sin marco/lienzo. Si no, null.
function tallaImprimible(variante: string): "A4" | "A3" | null {
  if (/rahmen|frame|matte|canvas|leinwand/i.test(variante)) return null;
  const m = variante.match(/\bA([0-9])\b/i);
  if (!m) return null;
  return m[1] === "4" ? "A4" : m[1] === "3" ? "A3" : null;
}

function abrirPdf(numero: string, items: ArticuloImpreso[]) {
  const job: { [k: string]: { nombre: string; talla: string; qty: number } } = {};
  for (const it of items) {
    const k = `${it.nombre}-${it.talla}`;
    job[k] = job[k] ? { ...job[k], qty: job[k].qty + it.cantidad } : { nombre: it.nombre, talla: it.talla, qty: it.cantidad };
  }
  localStorage.setItem("or_print_job", JSON.stringify(Object.values(job)));
  // El número de pedido viaja como "mercado" para nombrar el PDF: pedido-1057-imprimir-A4-...
  localStorage.setItem("or_print_mercado", `pedido ${numero.replace("#", "")}`);
  localStorage.setItem("or_print_kind", "pedido");
  window.open("/imprimir", "_blank");
}

export default function PedidosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pedidos, setPedidos] = useState<PedidoShopify[]>([]);
  const [posters, setPosters] = useState<PosterMin[]>([]);
  const [mapa, setMapa] = useState<{ [clave: string]: string }>({}); // clave → poster_id
  const [impresos, setImpresos] = useState<Impreso[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.perfil !== "marcello") { router.replace("/"); return; }
    cargar();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const [resShop, posRes, mapRes, impRes] = await Promise.all([
        fetch("/api/shopify/pedidos", { headers: { Authorization: `Bearer ${session?.access_token || ""}` }, cache: "no-store" }),
        supabase.from("posters").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("shopify_poster_map").select("clave, poster_id"),
        supabase.from("pedidos_impresos").select("*").order("impreso_at", { ascending: false }),
      ]);
      if (mapRes.error || impRes.error) { setError(t.ordersNeedSql); setCargando(false); return; }
      const json = await resShop.json();
      if (!resShop.ok) { setError(json.error === "no_configurado" ? t.labelOrderNotConfigured : t.labelOrderError); setCargando(false); return; }
      setPedidos(json.pedidos || []);
      setPosters((posRes.data as PosterMin[]) || []);
      setMapa(Object.fromEntries(((mapRes.data as { clave: string; poster_id: string }[]) || []).map((m) => [m.clave, m.poster_id])));
      setImpresos((impRes.data as Impreso[]) || []);
    } catch {
      setError(t.labelOrderError);
    }
    setCargando(false);
  }

  // Póster de la app para un producto de Shopify: lo elegido antes o, si no,
  // coincidencia exacta del nombre limpio. Si no hay, null (se pregunta).
  function posterDe(producto: string): PosterMin | null {
    const clave = normalizar(producto);
    const id = mapa[clave];
    if (id) return posters.find((p) => p.id === id) || null;
    return posters.find((p) => normalizar(p.nombre) === clave) || null;
  }

  async function asignar(producto: string, posterId: string) {
    if (!posterId) return;
    const clave = normalizar(producto);
    const { error: e } = await supabase.from("shopify_poster_map").upsert({ clave, titulo: producto, poster_id: posterId });
    if (e) { alert(t.saveError); return; }
    setMapa((prev) => ({ ...prev, [clave]: posterId }));
  }

  // Lo que va al PDF de un pedido (A4/A3 ya identificados)
  function articulosImprimibles(p: PedidoShopify): ArticuloImpreso[] {
    const out: ArticuloImpreso[] = [];
    for (const a of p.articulos) {
      const talla = tallaImprimible(a.variante);
      const poster = talla ? posterDe(a.producto) : null;
      if (talla && poster) out.push({ nombre: poster.nombre, talla, cantidad: a.cantidad });
    }
    return out;
  }

  async function marcarImpreso(p: PedidoShopify) {
    setGuardando(p.id);
    const fila = {
      shopify_id: p.id, numero: p.numero, fecha: p.fecha, cliente: p.nombre || null,
      articulos: articulosImprimibles(p),
    };
    const { data, error: e } = await supabase.from("pedidos_impresos").upsert(fila).select("*").single();
    setGuardando(null);
    if (e || !data) { alert(t.saveError); return; }
    setImpresos((prev) => [data as Impreso, ...prev.filter((x) => x.shopify_id !== p.id)]);
  }

  const idsImpresos = new Set(impresos.map((i) => i.shopify_id));
  const pendientes = pedidos.filter((p) => !idsImpresos.has(p.id));
  const fechaCorta = (f: string) => new Date(f.slice(0, 10) + "T12:00:00").toLocaleDateString("es-DE", { day: "numeric", month: "short" });

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.ordersTitle}</h1>
        <p className="text-gray-500 text-sm">{t.ordersSubtitle}</p>
      </div>

      <div className="flex gap-2">
        {(["pendientes", "historial"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${tab === id ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {id === "pendientes" ? `${t.ordersPending}${pendientes.length ? ` (${pendientes.length})` : ""}` : t.ordersHistory}
          </button>
        ))}
      </div>

      {cargando && <p className="text-sm text-gray-400 text-center py-8">{t.labelOrderLoading}</p>}
      {!cargando && error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      {!cargando && !error && tab === "pendientes" && (
        <div className="space-y-4">
          {pendientes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.labelOrderNone}</p>}
          {pendientes.map((p) => {
            const imprimibles = articulosImprimibles(p);
            const faltaAsignar = p.articulos.some((a) => tallaImprimible(a.variante) && !posterDe(a.producto));
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-gray-900">{p.numero} <span className="font-normal text-gray-500">· {p.nombre}</span></p>
                  <p className="text-xs text-gray-400 shrink-0">{fechaCorta(p.fecha)}</p>
                </div>

                <div className="space-y-2">
                  {p.articulos.map((a, i) => {
                    const talla = tallaImprimible(a.variante);
                    const poster = talla ? posterDe(a.producto) : null;
                    if (!talla) {
                      return (
                        <div key={i} className="text-xs text-gray-400">
                          {a.cantidad}× {a.producto} · {a.variante} — {t.ordersNotPrintedHere}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="space-y-1">
                        <p className="text-sm text-gray-800">
                          {a.cantidad}× <span className="font-medium">{poster ? poster.nombre : a.producto}</span> · {talla}
                          {poster && normalizar(poster.nombre) !== normalizar(a.producto) && (
                            <span className="text-xs text-gray-400"> ({a.producto})</span>
                          )}
                        </p>
                        {!poster && (
                          <select defaultValue="" onChange={(e) => asignar(a.producto, e.target.value)} className="w-full text-sm border border-amber-300 bg-amber-50 rounded-lg py-2 px-3 focus:outline-none focus:border-black">
                            <option value="">{t.ordersWhichPoster}</option>
                            {posters.map((po) => <option key={po.id} value={po.id}>{po.nombre}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => abrirPdf(p.numero, imprimibles)}
                    disabled={imprimibles.length === 0 || faltaAsignar}
                    className="flex-1 py-2.5 rounded-xl bg-black text-white font-semibold text-sm disabled:opacity-40"
                  >
                    {t.ordersPrint}
                  </button>
                  <button
                    onClick={() => marcarImpreso(p)}
                    disabled={guardando === p.id || faltaAsignar}
                    className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-40"
                  >
                    {guardando === p.id ? t.saving : t.ordersMarkPrinted}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!cargando && !error && tab === "historial" && (
        <div className="space-y-3">
          {impresos.length === 0 && <p className="text-sm text-gray-400 text-center py-8">{t.ordersHistoryEmpty}</p>}
          {impresos.map((i) => (
            <div key={i.shopify_id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-gray-900">{i.numero}{i.cliente && <span className="font-normal text-gray-500"> · {i.cliente}</span>}</p>
                <p className="text-xs text-gray-400 shrink-0">{t.ordersPrintedOn} {fechaCorta(i.impreso_at)}</p>
              </div>
              {i.articulos.map((a, k) => (
                <p key={k} className="text-sm text-gray-700">{a.cantidad}× {a.nombre} · {a.talla}</p>
              ))}
              {i.articulos.length > 0 && (
                <button onClick={() => abrirPdf(i.numero, i.articulos)} className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm">
                  {t.ordersDownloadPdf}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
