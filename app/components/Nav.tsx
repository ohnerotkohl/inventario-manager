"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useLang } from "./LangProvider";
import { veEstudio } from "@/lib/perfil";

const GuiaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
  </svg>
);

const PrintsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
);

const ScanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>
);

const EtiquetaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);

const NovedadesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const MasIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
);

const StockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="1"/>
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

const SesionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

const StatsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const ComprasIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.57L23 6H6"/>
  </svg>
);

const TurnosIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const TareasIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);

const FinanzasIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 010-4h14v4"/>
    <path d="M3 5v14a2 2 0 002 2h16v-5"/>
    <path d="M18 12a2 2 0 000 4h4v-4z"/>
  </svg>
);

const BalanceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.8 0-3 1-3 2s.8 1.7 3 2c2.2.3 3 1 3 2s-1.2 2-3 2c-1.3 0-2.4-.5-3-1.5"/>
    <line x1="12" y1="6" x2="12" y2="8"/>
    <line x1="12" y1="16" x2="12" y2="18"/>
  </svg>
);

const AdminIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);


export default function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLang();
  const [masAbierto, setMasAbierto] = useState(false);
  // explosión de partículas donde tocas el menú (grande al abrir "Más")
  const [estallido, setEstallido] = useState<{ id: number; x: number; y: number; grande: boolean } | null>(null);
  const tocar = (e: React.PointerEvent, grande = false) => setEstallido({ id: Date.now(), x: e.clientX, y: e.clientY, grande });

  if (!user || pathname === "/login") return null;

  // Abajo solo lo esencial del día a día; el resto vive en el panel "Más"
  // (Restock vive dentro de Stock /inventario)
  const adminLinks = [
    { href: "/", label: t.home, Icon: HomeIcon },
    { href: "/inventario", label: t.stock, Icon: StockIcon },
    { href: "/sesion", label: t.session, Icon: SesionIcon },
    { href: "/balance", label: t.balance, Icon: BalanceIcon },
    { href: "/tareas", label: t.tasks, Icon: TareasIcon },
  ];

  // El estudio (prints) y el generador de etiquetas son solo de Marcello.
  const soloEstudio = veEstudio(user.perfil);
  const masLinks = [
    { href: "/finanzas", label: t.finance, Icon: FinanzasIcon },
    { href: "/turnos", label: t.shifts, Icon: TurnosIcon },
    { href: "/estadisticas", label: t.stats, Icon: StatsIcon },
    { href: "/compras", label: t.purchases, Icon: ComprasIcon },
    ...(soloEstudio ? [{ href: "/prints", label: t.prints, Icon: PrintsIcon }] : []),
    { href: "/hoja-escaneo", label: t.scanSheet, Icon: ScanIcon },
    ...(soloEstudio ? [{ href: "/etiquetas", label: t.labels, Icon: EtiquetaIcon }] : []),
    { href: "/admin", label: t.team, Icon: AdminIcon },
    { href: "/novedades", label: t.news, Icon: NovedadesIcon },
    { href: "/guia", label: t.guide, Icon: GuiaIcon },
  ];

  const empleadoLinks = [
    { href: "/sesion", label: t.session, Icon: SesionIcon },
    { href: "/balance", label: t.balance, Icon: BalanceIcon },
    { href: "/inventario", label: t.stock, Icon: StockIcon },
    { href: "/guia", label: t.guide, Icon: GuiaIcon },
  ];

  const esAdmin = user.rol === "admin";
  const links = esAdmin ? adminLinks : empleadoLinks;
  const enMas = masLinks.some((l) => l.href === pathname);
  // Prueba dark mode: el Inicio es oscuro y el menú lo acompaña
  const oscuro = pathname === "/";

  const itemClass = (active: boolean) =>
    `flex flex-col items-center py-2 px-1.5 gap-0.5 text-[10px] transition-colors min-w-0 ${
      active
        ? oscuro ? "text-white font-semibold" : "text-black font-semibold"
        : oscuro ? "text-gray-500" : "text-gray-400"
    }`;

  return (
    <>
      {/* Panel "Más" */}
      {masAbierto && esAdmin && (
        <>
          <div className="fixed inset-0 bg-black/50 z-10 mas-velo" onClick={() => setMasAbierto(false)} />
          <div className="fixed bottom-[52px] left-0 right-0 z-10 mas-sube">
            <div className={`max-w-2xl mx-auto rounded-t-2xl shadow-lg border ${oscuro ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}>
              <div className="grid grid-cols-3 gap-y-2 py-3">
                {masLinks.map(({ href, label, Icon }, i) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMasAbierto(false)}
                      onPointerDown={(e) => tocar(e)}
                      className={`${itemClass(active)} mas-icono`}
                      style={{ animationDelay: `${80 + i * 35}ms` }}
                    >
                      <Icon />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <nav className={`fixed bottom-0 left-0 right-0 border-t z-10 ${oscuro ? "bg-[rgba(11,12,15,.8)] backdrop-blur-md border-white/[.07]" : "bg-white border-gray-200"}`}>
        <div className="flex justify-around items-center max-w-2xl mx-auto">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={() => setMasAbierto(false)} onPointerDown={(e) => tocar(e)} className={itemClass(active)}>
                <Icon />
                {label}
              </Link>
            );
          })}
          {esAdmin && (
            <button
              onPointerDown={(e) => tocar(e, !masAbierto)}
              onClick={() => setMasAbierto(!masAbierto)}
              className={itemClass(enMas || masAbierto)}
            >
              <MasIcon />
              {t.more}
            </button>
          )}
        </div>
      </nav>
      {estallido && <Chispas key={estallido.id} x={estallido.x} y={estallido.y} grande={estallido.grande} />}
    </>
  );
}

// Al tocar el menú: un anillo de luz morada se expande y unas partículas saltan, caen con
// gravedad y se apagan. Al abrir "Más" la explosión es más grande y sale hacia arriba.
// Solo decoración: no recibe toques y desaparece sola.
function Chispas({ x, y, grande }: { x: number; y: number; grande: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [vivo, setVivo] = useState(true);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return setVivo(false);
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    const cx = cv.getContext("2d")!;
    const ox = x * dpr,
      oy = y * dpr;
    const colores = ["179,136,255", "144,133,233", "110,98,214", "236,238,242"];
    const ps = Array.from({ length: grande ? 34 : 16 }, () => {
      // grande: abanico hacia arriba; pequeña: en todas direcciones, más suave
      const ang = grande ? -Math.PI / 2 + (Math.random() - 0.65) * 1.9 : Math.random() * Math.PI * 2,
        vel = (grande ? 3 + Math.random() * 5.5 : 1.2 + Math.random() * 2.6) * dpr;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel - (grande ? 0 : 1.2 * dpr),
        r: (1 + Math.random() * (grande ? 1.8 : 1.3)) * dpr,
        c: colores[Math.floor(Math.random() * colores.length)],
        vida: 0,
        dura: (grande ? 50 : 32) + Math.random() * 30,
      };
    });
    let marco = 0,
      cancelado = false;
    const paso = () => {
      if (cancelado) return;
      cx.clearRect(0, 0, cv.width, cv.height);
      marco++;
      // anillo de luz que se expande desde el dedo
      const anillo = marco / 24;
      if (anillo < 1) {
        cx.shadowBlur = 0;
        cx.strokeStyle = `rgba(179,136,255,${0.55 * (1 - anillo)})`;
        cx.lineWidth = 2 * dpr * (1 - anillo) + 0.5;
        cx.beginPath();
        cx.arc(ox, oy, (grande ? 46 : 30) * dpr * (1 - Math.pow(1 - anillo, 3)), 0, 7);
        cx.stroke();
      }
      let quedan = anillo < 1;
      for (const p of ps) {
        if (p.vida > p.dura) continue;
        quedan = true;
        p.vida++;
        p.vy += 0.16 * dpr; // gravedad
        p.vx *= 0.975; // rozamiento del aire
        p.vy *= 0.975;
        p.x += p.vx;
        p.y += p.vy;
        const a = 1 - p.vida / p.dura;
        cx.shadowBlur = 8 * dpr;
        cx.shadowColor = `rgba(${p.c},${a})`;
        cx.fillStyle = `rgba(${p.c},${a})`;
        cx.beginPath();
        cx.arc(p.x, p.y, p.r * (0.6 + a * 0.4), 0, 7);
        cx.fill();
      }
      if (quedan) requestAnimationFrame(paso);
      else setVivo(false);
    };
    requestAnimationFrame(paso);
    return () => {
      cancelado = true;
    };
  }, [x, y, grande]);

  if (!vivo) return null;
  return <canvas ref={lienzo} aria-hidden className="fixed inset-0 w-full h-full z-20 pointer-events-none" />;
}
