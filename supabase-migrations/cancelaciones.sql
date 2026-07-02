-- Mercados cancelados (calor, lluvia, etc.): contexto para las estadísticas,
-- sin ensuciar ventas ni promedios
CREATE TABLE cancelaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mercado_id UUID REFERENCES mercados(id) ON DELETE SET NULL,
  mercado_nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  motivo TEXT,
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX cancelaciones_fecha_idx ON cancelaciones (fecha DESC);

ALTER TABLE cancelaciones DISABLE ROW LEVEL SECURITY;
