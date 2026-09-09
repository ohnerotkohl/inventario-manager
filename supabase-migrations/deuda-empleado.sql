-- ============================================================================
-- DEUDA AL EMPLEADO: cuando el cash del día no alcanza para pagar el turno.
--
-- QUÉ HACE: guarda cuánto se le quedó debiendo al empleado en un balance.
-- Se calcula solo: coste del turno menos el efectivo disponible (el que queda
-- tras sacar el float). Si el efectivo no cubre el turno, la diferencia es la
-- deuda, para tenerla en el reporte y saber que hay que pagarla.
--
-- No toca RLS: la tabla balances ya tiene su política de autenticados.
-- ============================================================================

ALTER TABLE public.balances ADD COLUMN IF NOT EXISTS deuda_empleado numeric NOT NULL DEFAULT 0;
