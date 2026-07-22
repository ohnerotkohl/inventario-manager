-- ============================================================================
-- CIERRE: combos x3 vendidos por sesión.
--
-- QUÉ HACE: añade a la tabla de sesiones dos contadores que se rellenan a mano
-- al hacer el cierre: cuántos combos de 3 pósters A4 y cuántos de 3 pósters A3
-- se vendieron ese día (los packs con descuento de los mercados).
--
-- No toca RLS: la tabla sesiones ya tiene su política de autenticados.
-- ============================================================================

ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS combos_a4 integer NOT NULL DEFAULT 0;
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS combos_a3 integer NOT NULL DEFAULT 0;
