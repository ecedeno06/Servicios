-- Migracion 065: url (enlace de referencia) en el catalogo de checklist.

alter table checklists add column if not exists url text;
