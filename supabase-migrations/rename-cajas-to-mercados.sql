-- Renombrar cajas con nombres de mercado en lugar de "Caja A/B/C/D"
UPDATE cajas SET nombre = 'Boxie RAW',        descripcion = 'Boxhagener Platz (sáb) + RAW (dom)' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE cajas SET nombre = 'Kollwitzplatz',    descripcion = 'Kollwitzplatz (sáb)'                WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE cajas SET nombre = 'Hackescher Markt', descripcion = 'Hackescher Markt (sáb)'             WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE cajas SET nombre = 'Mauerpark',        descripcion = 'Mauerpark (dom)'                    WHERE id = '44444444-4444-4444-4444-444444444444';
