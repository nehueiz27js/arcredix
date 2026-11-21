-- ARCREDIX administrator credentials and independent session authentication.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS password_hash text;
