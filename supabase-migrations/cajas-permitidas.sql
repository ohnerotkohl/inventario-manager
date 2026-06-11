-- Permisos de conteo de stock por caja.
-- NULL = todas las cajas (comportamiento anterior); array = solo esas cajas.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cajas_permitidas UUID[] DEFAULT NULL;
