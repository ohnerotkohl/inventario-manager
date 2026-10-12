"use client";

import { useEffect, useRef } from "react";
import { LINEAS, RELLENO, REPOLLO_ASPECTO } from "@/lib/repollo";

// Pequeño juego para las pantallas de confirmación: el repollo de Ohne Rotkohl hecho de
// partículas en 3D (el mismo de la página Relax de Contabilidad, adaptado al móvil).
// - Deslizar el dedo: los puntos se apartan y el repollo gira con inercia.
// - Un toque: estalla y se recompone despacio.
// Solo decoración: no toca ningún dato.
export default function RepolloJuego({ alto = 230 }: { alto?: number }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cont = caja.current;
    if (!cont) return;
    // el lienzo va directamente en <body>: ocupa toda la pantalla aunque la página esté
    // animándose, queda por encima del contenido y por debajo de la cabecera y el menú
    const cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.className = "fixed inset-0 w-screen h-screen pointer-events-none z-[5]";
    document.body.appendChild(cv);
    const cx = cv.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

    type P = { u: number; v: number; z: number; x: number; y: number; vx: number; vy: number; linea: boolean; fase: number; prof: number; tx: number; ty: number };
    const ps: P[] = [];
    // en el móvil basta con la mitad de los puntos (va fluido y gasta menos batería)
    const meter = (lista: number[], linea: boolean) => {
      for (let i = 0; i < lista.length; i += 4) {
        const u = lista[i] * 2 - 1,
          v = (lista[i + 1] * 2 - 1) * REPOLLO_ASPECTO;
        const r2 = Math.min(1, u * u + v * v);
        ps.push({ u, v, z: Math.sqrt(1 - r2) * 0.75, x: 0, y: 0, vx: 0, vy: 0, linea, fase: Math.random() * 6.28, prof: 1, tx: 0, ty: 0 });
      }
    };
    meter(RELLENO, false);
    meter(LINEAS, true);

    // el lienzo ocupa toda la pantalla (los puntos pueden volar por todas partes);
    // el repollo se dibuja centrado en su caja
    let W = 0,
      H = 0,
      radio = 1,
      cX = 0,
      cY = 0;
    let primera = true;
    const medir = () => {
      const r = cont.getBoundingClientRect();
      cX = (r.left + r.width / 2) * dpr;
      cY = (r.top + r.height / 2) * dpr;
      radio = (Math.min(r.width * 0.9, (r.height * 0.92) / REPOLLO_ASPECTO) / 2) * dpr;
    };
    const tam = () => {
      W = cv.width = Math.round(innerWidth * dpr);
      H = cv.height = Math.round(innerHeight * dpr);
      medir();
      if (primera) {
        for (const p of ps) {
          const a = Math.random() * Math.PI * 2,
            d = quieto ? 0 : Math.max(W, H) * (0.4 + Math.random() * 0.4);
          p.x = cX + Math.cos(a) * d;
          p.y = cY + Math.sin(a) * d;
        }
        primera = false;
      }
    };
    tam();
    addEventListener("resize", tam);

    // ---- dedo ----
    const dedo = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, abajo: false, x0: 0, y0: 0, t0: 0 };
    let rotX = 0,
      rotY = 0,
      velX = 0,
      velY = 0,
      explosion = -1e9;
    const pos = (e: PointerEvent) => ({ x: e.clientX * dpr, y: e.clientY * dpr });
    const mover = (e: PointerEvent) => {
      const q = pos(e);
      if (dedo.t) {
        dedo.vx = q.x - dedo.x;
        dedo.vy = q.y - dedo.y;
      }
      if (dedo.abajo) {
        velY += ((q.x - dedo.x) / dpr) * 0.0012;
        velX -= ((q.y - dedo.y) / dpr) * 0.0012;
      }
      dedo.x = q.x;
      dedo.y = q.y;
      dedo.t = performance.now();
    };
    const bajar = (e: PointerEvent) => {
      cont.setPointerCapture?.(e.pointerId);
      mover(e);
      dedo.abajo = true;
      dedo.x0 = dedo.x;
      dedo.y0 = dedo.y;
      dedo.t0 = performance.now();
    };
    // un toque corto (sin arrastrar): estalla desde ese punto
    const subir = () => {
      const corto = performance.now() - dedo.t0 < 300 && Math.hypot(dedo.x - dedo.x0, dedo.y - dedo.y0) < 10 * dpr;
      dedo.abajo = false;
      if (!corto) return;
      explosion = performance.now();
      for (const p of ps) {
        const dx = p.x - dedo.x,
          dy = p.y - dedo.y,
          d = Math.hypot(dx, dy) || 1;
        const f = (17 * dpr) / Math.max(0.3, d / (110 * dpr));
        p.vx += (dx / d) * f * (0.5 + Math.random());
        p.vy += (dy / d) * f * (0.5 + Math.random());
      }
    };
    const fuera = () => {
      dedo.abajo = false;
      dedo.x = dedo.y = -1e4;
    };
    cont.addEventListener("pointermove", mover);
    cont.addEventListener("pointerdown", bajar);
    cont.addEventListener("pointerup", subir);
    cont.addEventListener("pointercancel", fuera);
    cont.addEventListener("pointerleave", fuera);

    const CELDA = 16 * dpr;
    let vivo = true;
    const paso = () => {
      if (!vivo) return;
      const ahora = performance.now(),
        t = ahora / 1000;

      // giro con inercia; sin tocar, se balancea un poco y vuelve de frente
      if (!dedo.abajo) {
        velX += (Math.sin(t * 0.35) * 0.18 - rotX) * 0.0016;
        velY += (Math.sin(t * 0.27) * 0.28 - rotY) * 0.0016;
      }
      velX *= 0.95;
      velY *= 0.95;
      rotX += velX;
      rotY += velY;
      const cxr = Math.cos(rotX),
        sxr = Math.sin(rotX),
        cyr = Math.cos(rotY),
        syr = Math.sin(rotY);

      const activo = dedo.t > 0 && ahora - dedo.t < 900;
      const alcance = 60 * dpr;
      // explosión: medio segundo de vuelo libre (sin nada que tire de los puntos) y luego
      // vuelven planeando en unos 2-3 s, frenando al llegar, sin rebotes de gelatina
      const tras = (ahora - explosion) / 1000;
      let k = 0.017,
        roce = 0.9;
      if (tras < 0.5) {
        k = 0;
        roce = 0.965;
      } else if (tras < 3.2) {
        const f = (tras - 0.5) / 2.7;
        k = 0.0025 + 0.0145 * f * f;
        roce = 1 - 2.05 * Math.sqrt(k);
      }
      medir();

      cx.clearRect(0, 0, W, H);

      // una luz morada suave que pasa despacio
      const a = ahora * 0.00018;
      const lx = cX + Math.cos(a) * radio * 1.2,
        ly = cY + Math.sin(a * 1.3) * radio * 0.7,
        lr = radio * 0.8;
      cx.globalCompositeOperation = "lighter";
      const g = cx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g.addColorStop(0, "rgba(140,100,255,0.12)");
      g.addColorStop(1, "rgba(140,100,255,0)");
      cx.fillStyle = g;
      cx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
      cx.globalCompositeOperation = "source-over";

      for (const p of ps) {
        const fu = p.u + Math.sin(t * 0.8 + p.fase) * 0.008,
          fv = p.v + Math.cos(t * 0.7 + p.fase * 1.3) * 0.008;
        const x1 = fu * cyr + p.z * syr,
          z1 = -fu * syr + p.z * cyr;
        const y2 = fv * cxr - z1 * sxr,
          z2 = fv * sxr + z1 * cxr;
        const persp = 1 / (1 - z2 * 0.35);
        p.prof = persp;
        p.tx = cX + x1 * radio * persp;
        p.ty = cY + y2 * radio * persp;
        if (activo) {
          const dx = p.x - dedo.x,
            dy = p.y - dedo.y,
            d2 = dx * dx + dy * dy;
          if (d2 < alcance * alcance && d2 > 0.01) {
            const d = Math.sqrt(d2),
              f = (1 - d / alcance) * 2 * dpr;
            p.vx += (dx / d) * f + dedo.vx * 0.05 * (1 - d / alcance);
            p.vy += (dy / d) * f + dedo.vy * 0.05 * (1 - d / alcance);
          }
        }
        p.vx = (p.vx + (p.tx - p.x) * k) * roce;
        p.vy = (p.vy + (p.ty - p.y) * k) * roce;
        p.x += p.vx;
        p.y += p.vy;
      }
      dedo.vx *= 0.8;
      dedo.vy *= 0.8;

      // hilos de constelación entre vecinos; más vivos donde los puntos se han soltado
      const rejilla = new Map<number, P[]>();
      for (const p of ps) {
        const key = Math.floor(p.x / CELDA) * 10007 + Math.floor(p.y / CELDA);
        let c = rejilla.get(key);
        if (!c) rejilla.set(key, (c = []));
        c.push(p);
      }
      const tenue = new Path2D(),
        viva = new Path2D();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const suelto = Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) > 5 * dpr;
        if (!suelto && i % 3) continue;
        const gx = Math.floor(p.x / CELDA),
          gy = Math.floor(p.y / CELDA);
        let hilos = 0;
        for (let ix = 0; ix <= 1 && hilos < 2; ix++)
          for (let iy = -1; iy <= 1 && hilos < 2; iy++) {
            const c = rejilla.get((gx + ix) * 10007 + gy + iy);
            if (!c) continue;
            for (const q of c) {
              if (q === p) continue;
              const d = Math.hypot(p.x - q.x, p.y - q.y);
              if (d < CELDA && d > 2 * dpr) {
                const camino = suelto ? viva : tenue;
                camino.moveTo(p.x, p.y);
                camino.lineTo(q.x, q.y);
                if (++hilos >= 2) break;
              }
            }
          }
      }
      cx.lineWidth = 0.6 * dpr;
      cx.strokeStyle = "rgba(160,140,255,0.08)";
      cx.stroke(tenue);
      cx.strokeStyle = "rgba(185,155,255,0.3)";
      cx.stroke(viva);

      for (const p of ps) {
        const suelto = Math.min(1, (Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty)) / (60 * dpr));
        let brillo = Math.max(0.3, Math.min(1.25, (p.prof - 0.75) * 1.6));
        const dl = Math.hypot(p.x - lx, p.y - ly);
        if (dl < lr) brillo += (1 - dl / lr) * 0.6;
        const tamano = (p.linea ? 1.8 : 1.3) * dpr * p.prof;
        const al = Math.min(1, (p.linea ? 0.9 : 0.45) * brillo);
        if (suelto > 0.04) {
          const r = Math.round(215 + 30 * suelto),
            gg = Math.round(205 - 100 * suelto),
            b = Math.round(255 - 150 * suelto);
          cx.fillStyle = `rgba(${r},${gg},${b},${Math.min(1, al + 0.15)})`;
        } else cx.fillStyle = p.linea ? `rgba(215,205,255,${al})` : `rgba(130,115,230,${al})`;
        cx.fillRect(p.x - tamano / 2, p.y - tamano / 2, tamano, tamano);
      }
      requestAnimationFrame(paso);
    };
    paso();

    return () => {
      vivo = false;
      cv.remove();
      removeEventListener("resize", tam);
      cont.removeEventListener("pointermove", mover);
      cont.removeEventListener("pointerdown", bajar);
      cont.removeEventListener("pointerup", subir);
      cont.removeEventListener("pointercancel", fuera);
      cont.removeEventListener("pointerleave", fuera);
    };
  }, []);

  return (
    <div className="w-full">
      <div ref={caja} className="relative w-full select-none touch-none" style={{ height: alto }} aria-label="Repollo para jugar" />

      <p className="text-center text-[11px] tracking-wide text-[#8b909c] mt-1">Desliza para girarlo · toca para que estalle</p>
    </div>
  );
}
