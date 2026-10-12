-- Migracion 047: solo una vez verificado el backfill de la 046 (migrar
-- de columnas sueltas a la lista "contactos"), se eliminan las columnas
-- viejas. El telefono/acepta_whatsapp a nivel de proveedor dejan de
-- existir -- cada contacto de la lista tiene su propio telefono, y el
-- boton de WhatsApp ahora se ofrece por cada uno (sin opt-in), igual
-- que ya pasa con los contactos de un servicio.
alter table proveedores
  drop column if exists contacto,
  drop column if exists correo,
  drop column if exists telefono,
  drop column if exists telefono_codigo_pais,
  drop column if exists acepta_whatsapp;
