-- ============================================================================
-- SEGURIDAD (Fase 1, complemento): permisos del almacén de imágenes.
--
-- QUÉ ARREGLA: desde que la app entra con sesión autenticada (login nuevo),
-- el bucket "Posters" de Storage rechazaba las peticiones de esa sesión y la
-- página de imprimir PDF no podía cargar ninguna imagen. Las tablas de datos
-- recibieron su política al activar RLS, pero Storage nunca recibió la suya.
--
-- QUÉ HACE: permite a los usuarios autenticados (los que entran con PIN) leer
-- las imágenes del bucket "Posters" para generar los enlaces firmados del PDF.
-- No abre nada al público: solo lectura, solo ese bucket, solo autenticados.
-- ============================================================================

DROP POLICY IF EXISTS "app_authenticated_posters_select" ON storage.objects;
CREATE POLICY "app_authenticated_posters_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'Posters');

-- ============================================================================
-- ROLLBACK (si hiciera falta deshacerlo):
-- DROP POLICY IF EXISTS "app_authenticated_posters_select" ON storage.objects;
-- ============================================================================
