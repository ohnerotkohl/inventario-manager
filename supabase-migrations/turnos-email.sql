-- Turnos: correo del trabajador (puede ser alguien nuevo, fuera de la app)
-- y estado del envío de la notificación
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS email_enviado BOOLEAN DEFAULT false;
