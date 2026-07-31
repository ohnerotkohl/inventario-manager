-- ============================================================================
-- PRECIOS POR MERCADO: para cuadrar el cierre de pósters con el balance de dinero.
--
-- QUÉ HACE: cada mercado guarda cuatro precios (el suelto y el combo x3, para A4
-- y A3). Con ellos la app calcula cuánto dinero DEBERÍA haber entrado según los
-- pósters marcados en el cierre, y lo compara con el balance de dinero del día.
--
-- Empiezan en 0 (= "sin precio configurado"): mientras estén a 0, la app no
-- intenta cuadrar ese mercado. Marcello los rellena desde la app.
--
-- No toca RLS: la tabla mercados ya tiene su política de autenticados.
-- ============================================================================

ALTER TABLE public.mercados ADD COLUMN IF NOT EXISTS precio_a4 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mercados ADD COLUMN IF NOT EXISTS precio_a3 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mercados ADD COLUMN IF NOT EXISTS precio_combo_a4 numeric NOT NULL DEFAULT 0;
ALTER TABLE public.mercados ADD COLUMN IF NOT EXISTS precio_combo_a3 numeric NOT NULL DEFAULT 0;
