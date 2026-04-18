-- ============================================
-- Añadir insumos de mantenimiento del estudio
-- ============================================
-- Ejecutar UNA SOLA VEZ en Supabase → SQL Editor

-- Papel por tamaño (desglosado del "Papeles" genérico)
INSERT INTO insumos_estudio (nombre, unidad, stock_minimo, cantidad) VALUES
  ('Papel A3', 'resmas', 1, 0),
  ('Papel A4', 'resmas', 1, 0);

-- Depósito de tinta (residuos / waste tank)
INSERT INTO insumos_estudio (nombre, unidad, stock_minimo, cantidad) VALUES
  ('Depósito de tinta', 'unidades', 1, 0);

-- Tintas desglosadas por color
INSERT INTO insumos_estudio (nombre, unidad, stock_minimo, cantidad) VALUES
  ('Tinta Magenta', 'cartuchos', 1, 0),
  ('Tinta Cyan', 'cartuchos', 1, 0),
  ('Tinta Yellow', 'cartuchos', 1, 0),
  ('Tinta CY', 'cartuchos', 1, 0),
  ('Tinta BK (Black)', 'cartuchos', 1, 0),
  ('Tinta PB (Photo Black)', 'cartuchos', 1, 0);

-- Opcional: si quieres eliminar el insumo genérico "Tintas"
-- (ya reemplazado por el desglose por color):
-- DELETE FROM insumos_estudio WHERE nombre = 'Tintas';
