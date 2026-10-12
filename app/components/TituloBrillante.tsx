"use client";

// Título de las confirmaciones: en el morado de la app, con un brillo que lo recorre y
// pequeñas partículas que suben desde las letras y se desvanecen. Solo decoración.
const CHISPAS = Array.from({ length: 10 }, (_, i) => ({
  left: 6 + ((i * 37) % 88),
  retraso: (i * 0.53) % 3.2,
  dur: 2.2 + ((i * 0.37) % 1.4),
  tam: 2 + (i % 3),
  deriva: ((i * 13) % 17) - 8,
}));

export default function TituloBrillante({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative inline-block px-2">
      <h2 className={`titulo-brillante font-bold ${className}`}>{children}</h2>
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
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
