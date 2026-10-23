-- Migracion 064: Hardware Address (ej. direccion de otra interfaz de red
-- del equipo, distinta de la MAC ya guardada) -- opcional.

alter table equipos_asignados add column if not exists hardware_address text;
