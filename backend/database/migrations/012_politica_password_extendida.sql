-- Migracion 012: politica de password extendida -- cantidad minima de
-- mayusculas/minusculas (en vez de "al menos una") y sets de caracteres
-- permitidos para numeros y especiales, configurables desde la pantalla
-- de super-admin.
--
-- A diferencia de la migracion 011, esta SI cambia el comportamiento
-- activo a proposito: siembra la politica con los valores pedidos
-- explicitamente (longitud minima 8, minimo 2 mayusculas, minimo 2
-- minusculas, numero y caracter especial obligatorios con los sets
-- indicados).

alter table politica_password add column if not exists mayuscula_minima integer not null default 0 check (mayuscula_minima >= 0);
alter table politica_password add column if not exists minuscula_minima integer not null default 0 check (minuscula_minima >= 0);
alter table politica_password add column if not exists caracteres_numericos text not null default '0123456789';
alter table politica_password add column if not exists caracteres_especiales text not null default '!@#$%^&*-_+=.,';

update politica_password set
  mayuscula_minima = case when requiere_mayuscula then 1 else 0 end,
  minuscula_minima = case when requiere_minuscula then 1 else 0 end
where id = 1;

alter table politica_password drop column if exists requiere_mayuscula;
alter table politica_password drop column if exists requiere_minuscula;

update politica_password set
  longitud_minima = 8,
  mayuscula_minima = 2,
  minuscula_minima = 2,
  requiere_numero = true,
  requiere_caracter_especial = true,
  caracteres_numericos = '1234567890',
  caracteres_especiales = '!@#$%^&*-_+=.,',
  updated_at = now()
where id = 1;

-- -----------------------------------------------------------------------
-- ROLLBACK (no se ejecuta solo -- correr a mano si hay que revertir esto)
-- -----------------------------------------------------------------------
-- alter table politica_password add column if not exists requiere_mayuscula boolean not null default false;
-- alter table politica_password add column if not exists requiere_minuscula boolean not null default false;
-- update politica_password set requiere_mayuscula = (mayuscula_minima > 0), requiere_minuscula = (minuscula_minima > 0) where id = 1;
-- alter table politica_password drop column if exists mayuscula_minima;
-- alter table politica_password drop column if exists minuscula_minima;
-- alter table politica_password drop column if exists caracteres_numericos;
-- alter table politica_password drop column if exists caracteres_especiales;
