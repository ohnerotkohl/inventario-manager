-- ============================================
-- Módulo Prints: almacén central de prints del estudio
-- (lo que hay físicamente para reponer las cajas de mercado)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Stock actual por diseño + talla (cantidad total, sin separar origen)
CREATE TABLE prints_estudio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poster_id UUID REFERENCES posters(id) ON DELETE CASCADE,
  talla TEXT NOT NULL CHECK (talla IN ('A4', 'A3')),
  cantidad INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poster_id, talla)
);

-- Historial de entradas (cuando se imprime en el taller o llega un pedido externo)
CREATE TABLE prints_entradas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poster_id UUID REFERENCES posters(id) ON DELETE CASCADE,
  talla TEXT NOT NULL CHECK (talla IN ('A4', 'A3')),
  cantidad INTEGER NOT NULL,
  origen TEXT NOT NULL DEFAULT 'taller' CHECK (origen IN ('taller', 'externo')),
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX prints_entradas_fecha_idx ON prints_entradas (created_at DESC);

-- Supabase activa RLS por defecto; la app controla el acceso con PIN/roles
ALTER TABLE prints_estudio DISABLE ROW LEVEL SECURITY;
ALTER TABLE prints_entradas DISABLE ROW LEVEL SECURITY;
