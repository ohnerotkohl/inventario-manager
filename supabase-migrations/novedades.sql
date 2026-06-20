-- ============================================
-- Módulo Novedades: historial de cambios/mejoras de la app
-- con aviso por email a los admins
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

CREATE TABLE novedades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  pedido_por TEXT,            -- quién pidió el cambio (Nuria, Marcello, Vinay...)
  notificada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX novedades_fecha_idx ON novedades (created_at DESC);

ALTER TABLE novedades DISABLE ROW LEVEL SECURITY;
