-- Separación por perfil: Marcello / Nuria (y "ambos" para lo compartido).
-- Cada perfil ve SOLO sus mercados, cajas, cierres, balances, estadísticas,
-- finanzas, restock, ideas y comisiones. El estudio (prints + insumos/despensa)
-- es solo de Marcello.
--
-- Idempotente: se puede volver a correr sin romper nada.

-- ── Usuarios ───────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'marcello';
UPDATE public.usuarios SET perfil = 'nuria'    WHERE nombre IN ('Nuria', 'Vinay');
UPDATE public.usuarios SET perfil = 'ambos'    WHERE nombre = 'Furda';
UPDATE public.usuarios SET perfil = 'marcello' WHERE nombre = 'Marcello';
UPDATE public.usuarios SET activo = false      WHERE nombre = 'Antonio';

-- ── Mercados ───────────────────────────────────────────────────────────────
ALTER TABLE public.mercados ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'marcello';
UPDATE public.mercados SET perfil = 'nuria'    WHERE nombre IN ('Boxhagener Platz', 'Hackescher Markt', 'RAW');
UPDATE public.mercados SET perfil = 'marcello' WHERE nombre IN ('Kollwitzplatz', 'Mauerpark');

-- ── Cajas (stock) ──────────────────────────────────────────────────────────
-- "Boxie RAW" la comparten Boxhagener y RAW, ambas de Nuria.
ALTER TABLE public.cajas ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'marcello';
UPDATE public.cajas SET perfil = 'nuria'    WHERE nombre IN ('Boxie RAW', 'Hackescher Markt');
UPDATE public.cajas SET perfil = 'marcello' WHERE nombre IN ('Kollwitzplatz', 'Mauerpark');

-- ── Ideas y comisiones ─────────────────────────────────────────────────────
-- Las existentes quedan de Marcello por defecto; las nuevas toman el perfil
-- del mercado donde se anotan.
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'marcello';
ALTER TABLE public.comisiones ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'marcello';

-- ── Tareas ─────────────────────────────────────────────────────────────────
-- Las tareas también se dividen por perfil. Las existentes quedan visibles
-- para ambos ('ambos'); las nuevas toman el perfil de quien las crea.
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS perfil text NOT NULL DEFAULT 'ambos';
