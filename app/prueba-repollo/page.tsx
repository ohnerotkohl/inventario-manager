"use client";

import RepolloJuego from "@/app/components/RepolloJuego";

// Página de prueba (temporal): enseña cómo queda el repollo en una confirmación,
// sin guardar ni tocar ningún dato. No sale en el menú.
export default function PruebaRepollo() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <RepolloJuego />
      <h2 className="text-2xl font-bold text-gray-900">¡Restock completado!</h2>
      <p className="text-gray-500">Esto es solo una prueba: no se ha guardado nada.</p>
    </div>
  );
}
