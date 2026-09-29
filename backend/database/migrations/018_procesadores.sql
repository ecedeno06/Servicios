-- Migracion 018: catalogo global de tipos de procesador (CPU), administrado
-- igual que categorias/productos (ver migracion 015). Se usa para completar
-- las especificaciones tecnicas de un equipo asignado (ver migracion 019).
create table if not exists procesadores (
    id      serial primary key,
    nombre  varchar(100) not null unique
);

insert into procesadores (nombre) values
    ('Intel Core i3'),
    ('Intel Core i5'),
    ('Intel Core i7'),
    ('Intel Core i9'),
    ('AMD Ryzen 5'),
    ('AMD Ryzen 7'),
    ('AMD Ryzen 9'),
    ('Apple M1'),
    ('Apple M2'),
    ('Apple M3'),
    ('Apple M4'),
    ('Apple M5')
on conflict (nombre) do nothing;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- drop table if exists procesadores;
