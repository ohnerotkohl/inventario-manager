"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Tema morado común con Contabilidad. Solo es visual: pone clases en <body>
// y dibuja el fondo animado. Las hojas que se imprimen se quedan en blanco.
const SIN_TEMA = ["/imprimir", "/hoja-escaneo"];
// Estas ya eran oscuras por su cuenta: llevan fondo y cristal, pero sin invertir colores
const YA_OSCURAS = ["/", "/login"];

// Etiqueta morada que sale encima del título de cada página
const CEJA: Record<string, string> = {
  "/inventario": "Stock",
  "/prints": "Stock",
  "/restock": "Stock",
  "/compras": "Compras",
  "/balance": "Mercados",
  "/sesion": "Mercados",
  "/turnos": "Equipo",
  "/tareas": "Equipo",
  "/estadisticas": "Ventas",
  "/finanzas": "Ventas",
  "/etiquetas": "Envíos",
  "/escanear": "Escáner",
  "/novedades": "Novedades",
  "/guia": "Ayuda",
  "/admin": "Ajustes",
  "/setup": "Ajustes",
};

export default function Tema() {
  const ruta = usePathname();
  const base = "/" + (ruta.split("/")[1] ?? "");
  const sinTema = SIN_TEMA.includes(base);

  useEffect(() => {
    const b = document.body;
    b.classList.toggle("tema", !sinTema);
    b.classList.toggle("invertir", !sinTema && !YA_OSCURAS.includes(ruta));
    const ceja = CEJA[base];
    if (ceja) b.style.setProperty("--ceja", JSON.stringify(ceja.toUpperCase()));
    else b.style.removeProperty("--ceja");
  }, [ruta, base, sinTema]);

  // al cambiar de página, cada bloque entra con un muelle: sube, se pasa un poco y se asienta
  useEffect(() => {
    if (sinTema || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.querySelector("main");
    if (!main) return;
    const raiz = () => main.firstElementChild;
    const animables = (el: Element) => !el.matches(".fixed, .sticky");
    let orden = 0;
    const entrar = (el: Element, retraso: number) => {
      if (animables(el)) (el as HTMLElement).animate(MUELLE, { duration: MUELLE_MS, delay: retraso, fill: "backwards" });
    };
    const r = raiz();
    if (r) [...r.children].forEach((el, i) => entrar(el, Math.min(i, 6) * 70));
    // lo que aparece después (al terminar de cargar datos) también entra con el muelle
    const ob = new MutationObserver((cambios) => {
      for (const c of cambios)
        for (const n of c.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (c.target === main) [...n.children].forEach((el, i) => entrar(el, Math.min(i, 6) * 70));
          else if (c.target === raiz()) entrar(n, Math.min(orden++, 4) * 50);
        }
      orden = 0;
    });
    ob.observe(main, { childList: true });
    if (r) ob.observe(r, { childList: true });
    return () => ob.disconnect();
  }, [ruta, sinTema]);

  if (sinTema) return null;
  return <Fondo />;
}

// Fotogramas de un muelle real (rigidez 170, amortiguación 14): se calculan una vez.
// La posición rebota un poco por encima de su sitio y se asienta; la opacidad sube rápido.
const { MUELLE, MUELLE_MS } = (() => {
  const k = 170,
    c = 14,
    dt = 1 / 120;
  let x = 1,
    v = 0,
    t = 0;
  const pasos: { x: number; t: number }[] = [];
  while (t < 2 && !(t > 0.2 && Math.abs(x) < 0.002 && Math.abs(v) < 0.02)) {
    pasos.push({ x, t });
    const f = -k * x - c * v;
    v += f * dt;
    x += v * dt;
    t += dt;
  }
  pasos.push({ x: 0, t });
  const total = t;
  const marcos = pasos
    .filter((_, i) => i % 4 === 0 || i === pasos.length - 1)
    .map((p) => ({
      offset: p.t / total,
      opacity: Math.min(1, (p.t / total) * 4),
      transform: `translateY(${(p.x * 18).toFixed(2)}px) scale(${(1 - p.x * 0.015).toFixed(4)})`,
    }));
  marcos[marcos.length - 1].offset = 1;
  return { MUELLE: marcos as Keyframe[], MUELLE_MS: Math.round(total * 1000) };
})();

function Fondo() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;
    const cx = cv.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colores = ["144,133,233", "179,136,255", "110,98,214"];
    const toque = { x: -1e4, y: -1e4 };
    type P = { x: number; y: number; vx: number; vy: number; bx: number; by: number; r: number; c: string };
    let W = 0,
      H = 0,
      ps: P[] = [],
      vivo = true;

    // posición del dedo o del ratón: aparta las partículas y enciende el borde de la tarjeta
    const mover = (e: PointerEvent) => {
      toque.x = e.clientX * dpr;
      toque.y = e.clientY * dpr;
      const t = (e.target as Element | null)?.closest?.(".rounded-2xl.border") as HTMLElement | null;
      if (t) {
        const r = t.getBoundingClientRect();
        t.style.setProperty("--x", `${e.clientX - r.left}px`);
        t.style.setProperty("--y", `${e.clientY - r.top}px`);
      }
    };
    const soltar = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") toque.x = toque.y = -1e4;
    };
    const tam = () => {
      W = cv.width = innerWidth * dpr;
      H = cv.height = innerHeight * dpr;
      // en el móvil, menos partículas (gastan menos batería)
      const n = innerWidth < 768 ? 34 : 80;
      ps = Array.from({ length: n }, () => {
        const vx = (Math.random() - 0.5) * 0.4 * dpr,
          vy = (Math.random() - 0.5) * 0.4 * dpr;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          vx,
          vy,
          bx: vx,
          by: vy,
          r: (Math.random() * 1.6 + 0.6) * dpr,
          c: colores[Math.floor(Math.random() * 3)],
        };
      });
    };
    tam();
    addEventListener("resize", tam);
    addEventListener("pointermove", mover, { passive: true });
    addEventListener("pointerdown", mover, { passive: true });
    addEventListener("pointerup", soltar, { passive: true });

    const lejos = (innerWidth < 768 ? 110 : 140) * dpr,
      radio = 160 * dpr;
    const paso = () => {
      if (!vivo) return;
      cx.clearRect(0, 0, W, H);
      for (const p of ps) {
        const dx = p.x - toque.x,
          dy = p.y - toque.y,
          d = Math.hypot(dx, dy);
        if (d < radio && d > 0) {
          const f = (1 - d / radio) * 0.9;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        p.vx += (p.bx - p.vx) * 0.03;
        p.vy += (p.by - p.vy) * 0.03;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) {
          p.x = Math.min(W, Math.max(0, p.x));
          p.vx = p.x === 0 ? Math.abs(p.vx) : -Math.abs(p.vx);
        }
        if (p.y < 0 || p.y > H) {
          p.y = Math.min(H, Math.max(0, p.y));
          p.vy = p.y === 0 ? Math.abs(p.vy) : -Math.abs(p.vy);
        }
      }
      cx.lineWidth = dpr * 0.8;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j],
            d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < lejos) {
            cx.strokeStyle = `rgba(${a.c},${0.17 * (1 - d / lejos)})`;
            cx.beginPath();
            cx.moveTo(a.x, a.y);
            cx.lineTo(b.x, b.y);
            cx.stroke();
          }
        }
        const dm = Math.hypot(a.x - toque.x, a.y - toque.y);
        if (dm < radio * 1.4) {
          cx.strokeStyle = `rgba(${a.c},${0.28 * (1 - dm / (radio * 1.4))})`;
          cx.beginPath();
          cx.moveTo(a.x, a.y);
          cx.lineTo(toque.x, toque.y);
          cx.stroke();
        }
      }
      for (const p of ps) {
        cx.fillStyle = `rgba(${p.c},.6)`;
        cx.beginPath();
        cx.arc(p.x, p.y, p.r, 0, 7);
        cx.fill();
      }
      if (!quieto) requestAnimationFrame(paso);
    };
    paso();
    return () => {
      vivo = false;
      removeEventListener("resize", tam);
      removeEventListener("pointermove", mover);
      removeEventListener("pointerdown", mover);
      removeEventListener("pointerup", soltar);
    };
  }, []);

  return (
    <div className="fondo" aria-hidden>
      <div className="mancha m1" />
      <div className="mancha m2" />
      <div className="mancha m3" />
      <canvas ref={lienzo} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
