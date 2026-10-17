-- Marca que productos del catalogo (categorias/productos/procesadores en
-- Equipos) requieren pasar por el checklist al asignarlos -- pedido
-- explicito, por defecto false (no rompe nada existente).
alter table productos add column if not exists aplica_checklist boolean not null default false;
