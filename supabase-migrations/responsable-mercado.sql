-- ============================================================================
-- RESPONSABLE POR MERCADO: para avisar al cerrar un mercado que no es el tuyo.
--
-- QUÉ HACE: cada mercado guarda quién es su responsable. Al empezar un cierre,
-- si el mercado no es tuyo, la app te avisa ("no eres Vinay, ¿cerrar Hackescher?")
-- para evitar cerrar el mercado equivocado por error.
--
-- No toca RLS: la tabla mercados ya tiene su política de autenticados.
-- ============================================================================

ALTER TABLE public.mercados ADD COLUMN IF NOT EXISTS responsable text;

UPDATE public.mercados SET responsable = 'Nuria'    WHERE nombre IN ('Boxhagener Platz', 'RAW');
UPDATE public.mercados SET responsable = 'Vinay'    WHERE nombre = 'Hackescher Markt';
UPDATE public.mercados SET responsable = 'Marcello' WHERE nombre IN ('Kollwitzplatz', 'Mauerpark');
