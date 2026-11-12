-- Pedidos de Shopify para imprimir (página /pedidos, solo Marcello).
-- Ejecutar una vez en el SQL Editor de Supabase. Idempotente.

-- 1) Pedidos ya impresos (historial). Los pendientes se leen de Shopify en vivo;
--    al marcar "impreso" se guarda aquí qué se imprimió para poder re-descargar
--    el PDF. No se guardan direcciones: solo número, fecha, nombre y pósters.
CREATE TABLE IF NOT EXISTS public.pedidos_impresos (
  shopify_id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  fecha DATE,
  cliente TEXT,
  -- [{ "nombre": "Octopus", "talla": "A4", "cantidad": 1 }]
  articulos JSONB NOT NULL DEFAULT '[]'::jsonb,
  impreso_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Equivalencias producto de Shopify → póster de la app (los nombres de la
--    tienda están en alemán y no coinciden). Se rellena sola la primera vez que
--    Marcello elige "¿qué póster es este?".
CREATE TABLE IF NOT EXISTS public.shopify_poster_map (
  clave TEXT PRIMARY KEY,          -- título del producto en Shopify, normalizado
  titulo TEXT,                     -- título en Shopify, para reconocerlo
  poster_id UUID NOT NULL REFERENCES public.posters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Misma protección que el resto de tablas: solo con sesión de la app.
ALTER TABLE public.pedidos_impresos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_authenticated_all ON public.pedidos_impresos;
CREATE POLICY app_authenticated_all ON public.pedidos_impresos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.shopify_poster_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_authenticated_all ON public.shopify_poster_map;
CREATE POLICY app_authenticated_all ON public.shopify_poster_map
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
