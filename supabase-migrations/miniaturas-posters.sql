-- ============================================================================
-- MINIATURAS DE PÓSTERS
--
-- QUÉ HACE: deja que la app (usuarios autenticados, los que entran con PIN)
-- SUBA archivos al bucket "Posters", pero SOLO dentro de la carpeta
-- "miniaturas/". Ahí guarda versiones pequeñas (~20 KB) de cada póster para
-- verlos en listas (p. ej. en Pedidos, al elegir qué póster es un producto de
-- Shopify). No puede tocar, cambiar ni borrar las imágenes grandes de imprimir.
-- ============================================================================

DROP POLICY IF EXISTS "app_authenticated_miniaturas_insert" ON storage.objects;
CREATE POLICY "app_authenticated_miniaturas_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Posters' AND name LIKE 'miniaturas/%');

-- ============================================================================
-- ROLLBACK (si hiciera falta deshacerlo):
-- DROP POLICY IF EXISTS "app_authenticated_miniaturas_insert" ON storage.objects;
-- ============================================================================
