-- ============================================
-- OHNE ROTKOHL - Inventory Management System
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Series (colecciones de pósters)
CREATE TABLE series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280'
);

-- Pósters
CREATE TABLE posters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serie_id UUID REFERENCES series(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tiene_a4 BOOLEAN DEFAULT true,
  tiene_a3 BOOLEAN DEFAULT true,
  activo BOOLEAN DEFAULT true
);

-- Cajas físicas de inventario
CREATE TABLE cajas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT
);

-- Mercados
CREATE TABLE mercados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  dia_semana TEXT NOT NULL,
  caja_id UUID REFERENCES cajas(id)
);

-- Inventario por caja (conteo de stock)
CREATE TABLE inventario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caja_id UUID REFERENCES cajas(id) ON DELETE CASCADE,
  poster_id UUID REFERENCES posters(id) ON DELETE CASCADE,
  talla TEXT NOT NULL CHECK (talla IN ('A4', 'A3')),
  cantidad INTEGER DEFAULT 0,
  out BOOLEAN DEFAULT false,
  sample_falta BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(caja_id, poster_id, talla)
);

-- Sesiones de mercado
CREATE TABLE sesiones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mercado_id UUID REFERENCES mercados(id),
  fecha DATE NOT NULL,
  trabajador TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ventas por sesión
CREATE TABLE ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  poster_id UUID REFERENCES posters(id),
  talla TEXT NOT NULL CHECK (talla IN ('A4', 'A3')),
  cantidad INTEGER DEFAULT 0
);

-- Materiales por caja (stand materials)
CREATE TABLE materiales_caja (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caja_id UUID REFERENCES cajas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  necesita_restock BOOLEAN DEFAULT false,
  UNIQUE(caja_id, nombre)
);

-- Insumos del estudio
CREATE TABLE insumos_estudio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cantidad INTEGER DEFAULT 0,
  unidad TEXT DEFAULT 'unidades',
  stock_minimo INTEGER DEFAULT 1,
  necesita_compra BOOLEAN DEFAULT false
);

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Cajas
INSERT INTO cajas (id, nombre, descripcion) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Caja A', 'Boxhagener Platz (sáb) + RAW (dom)'),
  ('22222222-2222-2222-2222-222222222222', 'Caja B', 'Kollwitzplatz (sáb)'),
  ('33333333-3333-3333-3333-333333333333', 'Caja C', 'Hackescher Markt (sáb)'),
  ('44444444-4444-4444-4444-444444444444', 'Caja D', 'Mauerpark (dom)');

-- Mercados
INSERT INTO mercados (nombre, dia_semana, caja_id) VALUES
  ('Boxhagener Platz', 'sabado', '11111111-1111-1111-1111-111111111111'),
  ('Kollwitzplatz', 'sabado', '22222222-2222-2222-2222-222222222222'),
  ('Hackescher Markt', 'sabado', '33333333-3333-3333-3333-333333333333'),
  ('RAW', 'domingo', '11111111-1111-1111-1111-111111111111'),
  ('Mauerpark', 'domingo', '44444444-4444-4444-4444-444444444444');

-- Series
INSERT INTO series (id, nombre, color) VALUES
  ('aaaa0001-0000-0000-0000-000000000000', 'Life is Food - Kitchen', '#F59E0B'),
  ('aaaa0002-0000-0000-0000-000000000000', 'Animals', '#10B981'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Fun', '#06B6D4'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Frases', '#3B82F6'),
  ('aaaa0005-0000-0000-0000-000000000000', 'Bauhaus', '#EC4899'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Berlin Prints', '#F97316'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Berlin Botanica', '#EAB308'),
  ('aaaa0008-0000-0000-0000-000000000000', 'Cocina', '#6366F1');

-- Pósters - Life is Food
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0001-0000-0000-0000-000000000000', 'Garlic'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Onion'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Gurke'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Egg plant'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Limes'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Oranges'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Paprika fever'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Capuccino fever'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Kaffee beans'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Croissants'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Mushrooms'),
  ('aaaa0001-0000-0000-0000-000000000000', 'Sushi');

-- Pósters - Animals
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0002-0000-0000-0000-000000000000', 'Octopus'),
  ('aaaa0002-0000-0000-0000-000000000000', 'The Boss Cat (Red)'),
  ('aaaa0002-0000-0000-0000-000000000000', 'The Boss Cat (Yellow)'),
  ('aaaa0002-0000-0000-0000-000000000000', 'My dog is super chill'),
  ('aaaa0002-0000-0000-0000-000000000000', 'Gato trippy'),
  ('aaaa0002-0000-0000-0000-000000000000', 'Miau');

-- Pósters - Fun
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0003-0000-0000-0000-000000000000', 'Best Seat Vintage'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Microdose'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Mit Karte Bitte'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Fick Dich'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Harry Pommes'),
  ('aaaa0003-0000-0000-0000-000000000000', 'U make me feel high pink'),
  ('aaaa0003-0000-0000-0000-000000000000', 'U make me feel high blue'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Ready for your shit'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Expresso yourself'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Keep your spirit high'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Clean is Good'),
  ('aaaa0003-0000-0000-0000-000000000000', 'Stay Chili');

-- Pósters - Frases
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0004-0000-0000-0000-000000000000', 'Genau'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Berlin'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Schön'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Danke'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Bitte'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Alles Klar'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Genau Vortice'),
  ('aaaa0004-0000-0000-0000-000000000000', 'Genau dit lauf shon');

-- Pósters - Bauhaus
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0005-0000-0000-0000-000000000000', '01 Orange chair'),
  ('aaaa0005-0000-0000-0000-000000000000', '02 Blue sky chair'),
  ('aaaa0005-0000-0000-0000-000000000000', '03 Blue sky building'),
  ('aaaa0005-0000-0000-0000-000000000000', '04 Blue building'),
  ('aaaa0005-0000-0000-0000-000000000000', '05 Orange house'),
  ('aaaa0005-0000-0000-0000-000000000000', '06 Yellow house'),
  ('aaaa0005-0000-0000-0000-000000000000', '07 Blue Orange House'),
  ('aaaa0005-0000-0000-0000-000000000000', '08 Black chair'),
  ('aaaa0005-0000-0000-0000-000000000000', '09 Bowie BH');

-- Pósters - Berlin Prints
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0006-0000-0000-0000-000000000000', 'Berlin Döner'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Mauerpark Flower'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Wie Geht''s? - Mauerpark'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Berlin Mauerpark - vintage girl'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Neukölln graffiti'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Brandenburger Tor'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Kreuzberg 36'),
  ('aaaa0006-0000-0000-0000-000000000000', 'I love Berlin'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Ick bin Bearliner'),
  ('aaaa0006-0000-0000-0000-000000000000', 'Berlin Disco Ball');

-- Pósters - Berlin Botanica
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0007-0000-0000-0000-000000000000', 'Mitte'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Kreuzberg'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Neukölln'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Schöneberg'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Prenzlauer Berg'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Wedding'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Friedriechshain'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Lichtenberg'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Charlottenburg'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Moabit'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Pankow'),
  ('aaaa0007-0000-0000-0000-000000000000', 'Spandau');

-- Pósters - Cocina
INSERT INTO posters (serie_id, nombre) VALUES
  ('aaaa0008-0000-0000-0000-000000000000', 'Siracha'),
  ('aaaa0008-0000-0000-0000-000000000000', 'Negroni'),
  ('aaaa0008-0000-0000-0000-000000000000', 'Prost'),
  ('aaaa0008-0000-0000-0000-000000000000', 'All we need is Ramen');

-- Materiales por caja (para las 4 cajas)
INSERT INTO materiales_caja (caja_id, nombre)
SELECT c.id, m.nombre
FROM cajas c
CROSS JOIN (
  VALUES
    ('Packing Bags'),
    ('Bags A4'),
    ('Bags A3'),
    ('Thumbtacks (chinchetas)'),
    ('Tape'),
    ('Gums'),
    ('Cards')
) AS m(nombre);

-- Insumos del estudio
INSERT INTO insumos_estudio (nombre, unidad, stock_minimo) VALUES
  ('Tintas', 'cartuchos', 2),
  ('Papeles', 'resmas', 2),
  ('Tarjetas de negocio', 'packs', 1),
  ('Bolsas de embalaje A4', 'unidades', 50),
  ('Bolsas de embalaje A3', 'unidades', 50),
  ('Bolsas de empaque', 'unidades', 50),
  ('Tanque limpiador de tintas', 'unidades', 1),
  ('Cartones A3', 'unidades', 20),
  ('Cartones A4', 'unidades', 20),
  ('Chinchetas', 'cajas', 1),
  ('Gomas de empaque', 'unidades', 20),
  ('Telas', 'metros', 2),
  ('Pinzas', 'unidades', 5),
  ('Martillo', 'unidades', 1),
  ('Lapicero', 'unidades', 3),
  ('Stickers', 'hojas', 5);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventario_updated_at
  BEFORE UPDATE ON inventario
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
