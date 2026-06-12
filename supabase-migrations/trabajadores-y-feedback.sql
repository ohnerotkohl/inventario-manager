-- Perfiles de trabajadores externos (para reutilizar nombre+correo al asignar turnos)
CREATE TABLE trabajadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Buzón de feedback de la beta (lo escribe cualquier usuario desde el header)
CREATE TABLE feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_nombre TEXT NOT NULL,
  texto TEXT NOT NULL,
  pagina TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trabajadores DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
