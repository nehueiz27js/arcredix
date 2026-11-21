-- Client access identifiers. Existing Neon Auth identities and merchant data remain intact.
ALTER TABLE public.merchant_users
  ADD COLUMN IF NOT EXISTS access_key_hash text,
  ADD COLUMN IF NOT EXISTS access_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS access_key_nonce text,
  ADD COLUMN IF NOT EXISTS access_key_tag text,
  ADD COLUMN IF NOT EXISTS access_key_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_users_access_key_hash_uq
  ON public.merchant_users (access_key_hash)
  WHERE access_key_hash IS NOT NULL;

-- Superadmin provisions the internal Neon Auth identity and links it to a merchant.
-- RLS still restricts these writes to an authenticated platform administrator.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_users TO arcredix_app;
