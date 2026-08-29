-- =========================================================
-- Migracion 006: logo de empresa (base64)
-- =========================================================

alter table empresas add column if not exists logo text;
