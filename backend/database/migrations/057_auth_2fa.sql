-- Verificacion en dos pasos (2FA) por app autenticadora (TOTP). El secreto
-- se guarda siempre cifrado (AES-256-CBC, clave en env CRYPTO_SECRET_KEY)
-- -- nunca en texto plano. two_factor_enabled queda en false por defecto
-- para todos los usuarios: nadie lo tiene activo hasta que se enrole
-- explicitamente desde "Seguridad" en el menu de usuario.
--
-- two_factor_challenge_hash es una "frase-reto" independiente de la
-- contrasena, definida al ACTIVAR el 2FA (hasheada con bcrypt, igual que
-- password_hash -- nunca reversible). Se exige como reto de un solo
-- intento antes de mandar el correo de recuperacion de 2FA (ver
-- dos_factor_recovery_tokens, migracion 058), para que alguien con acceso
-- solo al correo del usuario no pueda desactivarle el 2FA.
alter table usuarios add column if not exists two_factor_enabled boolean not null default false;
alter table usuarios add column if not exists two_factor_secret text;
alter table usuarios add column if not exists two_factor_challenge_hash text;
