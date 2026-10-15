-- Migracion 051: agrega "responsable" (texto abierto) a checklists.

alter table checklists add column if not exists responsable text;
