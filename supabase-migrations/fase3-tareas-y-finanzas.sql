-- ============================================
-- Fase 3 unificación: tareas, coles, turnos, chat,
-- gastos del estudio, lista de compras e ingresos históricos
-- (vienen de la app "compras y tareas OR")
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- ─── TAREAS con sistema de coles ─────────────────────────────
-- dificultad: simple = 1 col, media = 2 coles, compleja = 3-4 coles
CREATE TABLE tareas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT NOT NULL DEFAULT 'Otra',
  asignada_a UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  frecuencia TEXT NOT NULL DEFAULT 'puntual'
    CHECK (frecuencia IN ('diaria','semanal','mensual','puntual')),
  proxima_fecha DATE,
  dificultad TEXT NOT NULL DEFAULT 'media'
    CHECK (dificultad IN ('simple','media','compleja')),
  puntos_coles INT NOT NULL DEFAULT 2,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','atrasada','completada','urgente')),
  rotacion BOOLEAN NOT NULL DEFAULT false,
  orden_rotacion JSONB DEFAULT '[]'::jsonb,
  rotacion_idx INT NOT NULL DEFAULT 0,
  creada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER tareas_updated_at
  BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Registro de coles: cada trabajador parte de 100 al mes y las va
-- reduciendo al completar tareas; gana quien más reduce
CREATE TABLE coles_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  coles_delta INT NOT NULL,
  motivo TEXT NOT NULL,
  tarea_id UUID REFERENCES tareas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TURNOS ──────────────────────────────────────────────────
CREATE TABLE turnos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aceptado','rechazado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CHAT ────────────────────────────────────────────────────
CREATE TABLE canales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mensajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canal_id UUID REFERENCES canales(id) ON DELETE CASCADE NOT NULL,
  autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nombre TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tarea_id UUID REFERENCES tareas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── GASTOS DEL ESTUDIO (alimentan Finanzas → Negocio) ───────
CREATE TABLE gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe NUMERIC(10,2) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Otros',
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── LISTA DE COMPRAS (la "compras" de la app de tareas; la
-- página /compras del inventario sigue siendo insumos/materiales)
CREATE TABLE lista_compras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto TEXT NOT NULL,
  cantidad NUMERIC NOT NULL DEFAULT 1,
  unidad TEXT,
  precio NUMERIC(10,2),
  categoria TEXT NOT NULL DEFAULT 'Otro',
  quien_compra TEXT,
  urgente BOOLEAN NOT NULL DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','comprado')),
  fecha_compra TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INGRESOS HISTÓRICOS (balances de mercado anteriores a la
-- app unificada, solo total sin desglose de gastos) ────────────
CREATE TABLE ingresos_historicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  evento TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  notas TEXT,
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Supabase activa RLS por defecto; la app controla el acceso con PIN/roles
ALTER TABLE tareas DISABLE ROW LEVEL SECURITY;
ALTER TABLE coles_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE turnos DISABLE ROW LEVEL SECURITY;
ALTER TABLE canales DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes DISABLE ROW LEVEL SECURITY;
ALTER TABLE gastos DISABLE ROW LEVEL SECURITY;
ALTER TABLE lista_compras DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos_historicos DISABLE ROW LEVEL SECURITY;
