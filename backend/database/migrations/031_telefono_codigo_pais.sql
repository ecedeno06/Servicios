-- Migracion 031: codigo de pais del telefono del proveedor
-- El telefono se guardaba como texto libre (el usuario debia escribir el
-- codigo de pais a mano, ej. "+57 300 000 0000"), lo cual rompia el enlace
-- de WhatsApp (wa.me) si lo olvidaba. Se separa en dos campos: el codigo
-- de pais (select en el frontend) y el numero local.
-- Los contactos de un servicio (servicios_proveedores.contactos, jsonb)
-- no necesitan migracion: el campo nuevo se agrega dentro del objeto JSON.

alter table proveedores add column if not exists telefono_codigo_pais text;
