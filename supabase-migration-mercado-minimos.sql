-- ============================================================
-- MIGRACIÓN: Mínimos de restock por mercado
-- Ejecuta este archivo en el SQL Editor de Supabase
-- ============================================================

ALTER TABLE mercados ADD COLUMN IF NOT EXISTS min_bajo INTEGER DEFAULT 3;
ALTER TABLE mercados ADD COLUMN IF NOT EXISTS min_medio INTEGER DEFAULT 4;
ALTER TABLE mercados ADD COLUMN IF NOT EXISTS min_top  INTEGER DEFAULT 8;
ALTER TABLE mercados ADD COLUMN IF NOT EXISTS top_n    INTEGER DEFAULT 5;

-- Actualización inicial: Mauerpark ya queda con los valores por defecto
-- (bajo=3, medio=4, top=8, top_n=5) que es lo que quieres.
-- Si quieres afinar otros mercados puedes hacerlo aquí:
-- UPDATE mercados SET min_bajo=3, min_medio=4, min_top=6, top_n=3
--   WHERE nombre = 'Kollwitzplatz';
