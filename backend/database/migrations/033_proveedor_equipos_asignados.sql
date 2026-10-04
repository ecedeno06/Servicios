-- Migracion 033: proveedor del equipo asignado (de donde se compro/renta)

alter table equipos_asignados add column if not exists proveedor_id uuid references proveedores(id) on delete set null;
