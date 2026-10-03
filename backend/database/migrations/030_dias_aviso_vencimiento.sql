-- Migracion 030: dias de aviso antes de vencimiento para servicios_proveedores
-- Cuantos dias antes de fecha_fin se deberia avisar que el servicio esta por
-- vencer (sin uso todavia en notificaciones automaticas, solo se captura el
-- dato). No aplica a servicios indefinidos (sin fecha_fin).

alter table servicios_proveedores add column if not exists dias_aviso_vencimiento integer;
