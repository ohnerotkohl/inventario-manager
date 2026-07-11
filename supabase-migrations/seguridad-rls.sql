-- ============================================================================
-- SEGURIDAD: activar Row Level Security (RLS) en todas las tablas.
--
-- QUÉ HACE: sin una sesión autenticada válida (la que la app obtiene al meter
-- el PIN correcto), NADIE puede leer ni escribir la base de datos. La anon key
-- pública que va en el navegador deja de servir para tocar los datos por su
-- cuenta. La service_role key (solo servidor) se salta RLS, por eso las rutas
-- /api/auth/* siguen funcionando.
--
-- ⚠️  APLICAR SOLO DESPUÉS de confirmar que el login nuevo funciona (Fase 1):
--     si lo aplicas antes de desplegar el código nuevo, la app dejará de cargar
--     datos porque todavía entra como anónima.
--
-- Es reversible: al final del archivo, en comentario, está el SQL para volver
-- a desactivarlo si algo va mal.
-- ============================================================================

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'balances','cajas','canales','cancelaciones','coles_log','comisiones',
    'feedback','gastos','ideas','ingresos_historicos','insumos_estudio',
    'inventario','lista_compras','materiales_caja','mensajes','mercados',
    'novedades','posters','prints_entradas','prints_estudio','restock_lineas',
    'restocks','series','sesiones','tareas','trabajadores','turnos','usuarios',
    'ventas'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Una única política: acceso total SOLO para usuarios autenticados.
      -- Al no existir política para el rol 'anon', queda bloqueado por completo.
      EXECUTE format('DROP POLICY IF EXISTS app_authenticated_all ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY app_authenticated_all ON public.%I '
        'FOR ALL TO authenticated USING (true) WITH CHECK (true)', t
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- ROLLBACK (solo si hay que desactivar la protección de emergencia). Copia y
-- pega este bloque en el SQL Editor para volver al estado anterior:
--
-- DO $$
-- DECLARE
--   t text;
--   tablas text[] := ARRAY[
--     'balances','cajas','canales','cancelaciones','coles_log','comisiones',
--     'feedback','gastos','ideas','ingresos_historicos','insumos_estudio',
--     'inventario','lista_compras','materiales_caja','mensajes','mercados',
--     'novedades','posters','prints_entradas','prints_estudio','restock_lineas',
--     'restocks','series','sesiones','tareas','trabajadores','turnos','usuarios',
--     'ventas'
--   ];
-- BEGIN
--   FOREACH t IN ARRAY tablas LOOP
--     IF EXISTS (SELECT 1 FROM information_schema.tables
--                WHERE table_schema='public' AND table_name=t) THEN
--       EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--     END IF;
--   END LOOP;
-- END $$;
-- ============================================================================
