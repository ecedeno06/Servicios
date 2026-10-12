-- Migracion 046: el proveedor pasa de tener un solo contacto (columnas
-- contacto/correo/telefono/telefono_codigo_pais/acepta_whatsapp) a una
-- lista de contactos (jsonb), para poder registrar mas de uno. Forma de
-- cada entrada: {nombre, correo, codigo_pais, telefono, cargo}.

alter table proveedores add column if not exists contactos jsonb not null default '[]'::jsonb;

-- Backfill: el contacto unico que ya existia pasa a ser la primera (y
-- unica) entrada de la lista. Si no habia ningun dato de contacto, la
-- lista queda vacia (default).
update proveedores
set contactos = jsonb_build_array(
  jsonb_build_object(
    'nombre', coalesce(contacto, ''),
    'correo', correo,
    'codigo_pais', telefono_codigo_pais,
    'telefono', telefono,
    'cargo', null
  )
)
where contacto is not null or correo is not null or telefono is not null;
