-- ============================================
-- Fase 1 unificación: Balance monetario de mercado
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Costo del stand por mercado (gasto por defecto en el balance)
ALTER TABLE mercados ADD COLUMN IF NOT EXISTS costo_stand NUMERIC(10,2) DEFAULT 0;
UPDATE mercados SET costo_stand = 86.26 WHERE nombre = 'Mauerpark';
UPDATE mercados SET costo_stand = 66.64 WHERE nombre = 'Kollwitzplatz';

-- A quién pertenece la contabilidad de cada mercado:
-- 'negocio' = compartida (Kollwitzplatz, Boxhagener Platz, Hackescher Markt)
-- 'marcello' = ingresos 100% de Marcello (Mauerpark)
-- 'nuria' = ingresos 100% de Nuria (RAW)
ALTER TABLE mercados ADD COLUMN IF NOT EXISTS contabilidad TEXT NOT NULL DEFAULT 'negocio';
UPDATE mercados SET contabilidad = 'marcello' WHERE nombre = 'Mauerpark';
UPDATE mercados SET contabilidad = 'nuria' WHERE nombre = 'RAW';

-- Balance del día de mercado (antes en or-market-reports, sin historial)
CREATE TABLE balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mercado_id UUID REFERENCES mercados(id) ON DELETE SET NULL,
  mercado_nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  trabajador TEXT NOT NULL,
  turno_tipo TEXT NOT NULL DEFAULT 'na' CHECK (turno_tipo IN ('na', 'horas')),
  turno_horas NUMERIC(5,2) DEFAULT 0,
  turno_tarifa NUMERIC(6,2) DEFAULT 13,
  turno_costo NUMERIC(10,2) DEFAULT 0,
  float_inicial NUMERIC(10,2) DEFAULT 0,
  venta_sumup NUMERIC(10,2) DEFAULT 0,
  venta_efectivo NUMERIC(10,2) DEFAULT 0,
  venta_paypal NUMERIC(10,2) DEFAULT 0,
  iva_aplicado BOOLEAN DEFAULT false,
  iva_monto NUMERIC(10,2) DEFAULT 0,
  -- [{ "nombre": "Stand", "monto": 86.26, "efectivo": false }, ...]
  gastos JSONB DEFAULT '[]'::jsonb,
  total_gastos NUMERIC(10,2) DEFAULT 0,
  total_ventas NUMERIC(10,2) DEFAULT 0,
  neto NUMERIC(10,2) DEFAULT 0,
  email_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX balances_fecha_idx ON balances (fecha DESC);

-- Supabase activa RLS por defecto en tablas nuevas y bloquea los inserts
-- con la anon key; el resto de tablas de la app la tienen desactivada.
ALTER TABLE balances DISABLE ROW LEVEL SECURITY;
