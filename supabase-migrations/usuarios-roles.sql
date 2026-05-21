-- Tabla de usuarios con roles
CREATE TABLE usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'empleado')),
  puede_inventario BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
