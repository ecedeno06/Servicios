-- Migracion 079: los adjuntos del carrito son por SOLICITUD (carrito),
-- no por linea de equipo -- correccion de diseno sobre la migracion 076
-- (carrito_adjuntos quedo mal ligada a carrito_detalles).

alter table carrito_adjuntos add column if not exists carrito_id uuid references carritos(id) on delete cascade;

update carrito_adjuntos a
set carrito_id = d.carrito_id
from carrito_detalles d
where a.carrito_detalle_id = d.id and a.carrito_id is null;

alter table carrito_adjuntos alter column carrito_id set not null;
alter table carrito_adjuntos drop column if exists carrito_detalle_id;

create index if not exists idx_carrito_adjuntos_carrito on carrito_adjuntos(carrito_id);
drop index if exists idx_carrito_adjuntos_detalle;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- No hay forma de reconstruir carrito_detalle_id una vez borrado (la
-- relacion original equipo<->adjunto se pierde); restaurar desde backup.
