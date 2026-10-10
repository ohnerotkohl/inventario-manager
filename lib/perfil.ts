// Separación de negocios Marcello / Nuria.
// Cada mercado tiene un perfil ('marcello' | 'nuria'); cada usuario tiene un
// perfil ('marcello' | 'nuria' | 'ambos'). Un usuario ve un mercado si es del
// mismo perfil, o si el usuario es 'ambos' (ve los dos lados, p. ej. Furda).

export type Perfil = "marcello" | "nuria" | "ambos";

/** ¿El usuario (userPerfil) ve el mercado (mercadoPerfil)? */
export function veMercado(userPerfil: string | null | undefined, mercadoPerfil: string | null | undefined): boolean {
  if (userPerfil === "ambos" || !userPerfil) return true;
  return (mercadoPerfil || "marcello") === userPerfil;
}

/** El estudio (prints del almacén, insumos/despensa) es solo de Marcello. */
export function veEstudio(userPerfil: string | null | undefined): boolean {
  return userPerfil === "marcello" || userPerfil === "ambos";
}

/** Filtra una lista de mercados a los que ve el usuario. */
export function mercadosDelPerfil<T extends { perfil?: string | null }>(
  mercados: T[],
  userPerfil: string | null | undefined
): T[] {
  return mercados.filter((m) => veMercado(userPerfil, m.perfil));
}
