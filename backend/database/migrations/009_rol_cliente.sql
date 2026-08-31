-- Migracion 009: rol "cliente" + comentarios en registro_horas
-- Ver PORTAL-CLIENTE.md en la raiz del proyecto para el diseño completo.
--
-- Cambios (ambos aditivos, sin perdida de datos, faciles de revertir):
--   1) usuarios_empresas_rol.cliente_id (nuevo, nullable) + nuevo valor de
--      rol 'cliente' en el check existente.
--   2) registro_horas.comentarios (nuevo, jsonb, default '[]').

alter table usuarios_empresas_rol
  add column if not exists cliente_id uuid references clientes(id) on delete cascade;

alter table usuarios_empresas_rol
  drop constraint if exists usuarios_empresas_rol_rol_check;
alter table usuarios_empresas_rol
  add constraint usuarios_empresas_rol_rol_check
  check (rol in ('admin','supervisor','tecnico','cliente'));

-- El cliente_id es obligatorio solo cuando el rol es 'cliente', y debe
-- quedar vacio en cualquier otro rol.
alter table usuarios_empresas_rol
  drop constraint if exists chk_cliente_id_segun_rol;
alter table usuarios_empresas_rol
  add constraint chk_cliente_id_segun_rol check (
    (rol = 'cliente' and cliente_id is not null) or
    (rol <> 'cliente' and cliente_id is null)
  );

alter table registro_horas
  add column if not exists comentarios jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table registro_horas drop column if exists comentarios;
-- alter table usuarios_empresas_rol drop constraint if exists chk_cliente_id_segun_rol;
-- alter table usuarios_empresas_rol drop constraint if exists usuarios_empresas_rol_rol_check;
-- alter table usuarios_empresas_rol add constraint usuarios_empresas_rol_rol_check
--   check (rol in ('admin','supervisor','tecnico'));
-- alter table usuarios_empresas_rol drop column if exists cliente_id;
-- (el rollback del check original falla si ya existe alguna fila con rol='cliente' --
--  hay que reasignar/eliminar esas filas antes de revertir)
