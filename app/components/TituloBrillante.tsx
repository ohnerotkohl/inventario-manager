"use client";

// Título de las confirmaciones: en el morado de la app, con halo, un brillo morado rojizo
// que lo recorre y pequeñas partículas que suben. Al aparecer, una ráfaga de chispitas
// sale disparada una sola vez, como de "¡completado!". Solo decoración.
const CHISPAS = Array.from({ length: 10 }, (_, i) => ({
  left: 6 + ((i * 37) % 88),
  retraso: 1 + ((i * 0.53) % 3.2),
  dur: 2.2 + ((i * 0.37) % 1.4),
  tam: 2 + (i % 3),
  deriva: ((i * 13) % 17) - 8,
}));

// ráfaga inicial: 26 chispas en todas direcciones, de tamaños y distancias distintos
const RAFAGA = Array.from({ length: 26 }, (_, i) => {
  const ang = (i / 26) * Math.PI * 2 + ((i * 7) % 5) * 0.09;
  const dist = 46 + ((i * 29) % 52);
  const colores = ["#c4b8ff", "#e08bf0", "#9d8ff7", "#f3c4ff"];
  return {
    dx: Math.cos(ang) * dist * 1.6,
    dy: Math.sin(ang) * dist * 0.85,
    tam: 2 + (i % 4),
    retraso: ((i * 3) % 7) * 0.025,
    color: colores[i % colores.length],
  };
});

export default function TituloBrillante({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative inline-block px-2">
      <h2 className={`titulo-brillante font-bold ${className}`}>{children}</h2>
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
        {RAFAGA.map((c, i) => (
          <i
            key={`r${i}`}
            className="chispa-rafaga"
            style={
              {
                width: c.tam,
                height: c.tam,
                background: c.color,
                boxShadow: `0 0 8px ${c.color}`,
                animationDelay: `${c.retraso}s`,
                "--dx": `${c.dx}px`,
                "--dy": `${c.dy}px`,
              } as React.CSSProperties
            }
          />
        ))}
        {CHISPAS.map((c, i) => (
          <i
            key={i}
            className="chispa-titulo"
            style={
              {
                left: `${c.left}%`,
                width: c.tam,
                height: c.tam,
                animationDelay: `${c.retraso}s`,
                animationDuration: `${c.dur}s`,
                "--deriva": `${c.deriva}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
    </div>
  );
}
