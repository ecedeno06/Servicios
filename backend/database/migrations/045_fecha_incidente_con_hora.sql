-- Migracion 045: fecha_incidente pasa de "date" a "timestamptz" -- la
-- hora del incidente es relevante para el seguimiento (pedido
-- explicito), no solo el dia.
alter table servicio_incidentes
  alter column fecha_incidente type timestamptz using fecha_incidente::timestamptz,
  alter column fecha_incidente set default now();
