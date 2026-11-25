-- Bandera por item del catalogo de Checklist: si esta encendida, al
-- marcarse como completado ese item en un checklist de equipo se envia el
-- checklist completo en PDF por correo a administradores/super-admin +
-- rol RRHH de la empresa (ver equiposAsignados.controller.js).
alter table checklists add column if not exists notificacion_entrega boolean not null default false;
