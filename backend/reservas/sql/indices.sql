-- Índices para las consultas de disponibilidad.
--
-- Los modelos de Django usan managed=False, así que Django NO puede crear
-- estos índices con migraciones: hay que ejecutar este archivo una sola vez
-- en Supabase → SQL Editor. Es seguro repetirlo (IF NOT EXISTS).

-- Franjas por sala y fecha: acelera listar las franjas de una sala.
CREATE INDEX IF NOT EXISTS idx_franjas_recurso_fecha
    ON franjas (recurso_id, fecha);

-- Reservas por sala y fecha: acelera la subconsulta de solape (EXISTS)
-- que marca una franja como ocupada.
CREATE INDEX IF NOT EXISTS idx_reservas_recurso_fecha
    ON reservas (recurso_id, fecha, estado);
