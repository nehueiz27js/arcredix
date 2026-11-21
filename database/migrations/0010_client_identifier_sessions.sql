-- ARCREDIX client access: independent identifier sessions, without Neon Auth identities.
ALTER TABLE public.merchant_users
  ADD COLUMN IF NOT EXISTS access_key_hint text;

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('admin', 'client')),
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_ip_scope_created_idx
  ON public.login_attempts (ip, scope, created_at DESC);

-- The application owner uses this table only for login throttling.
GRANT SELECT, INSERT, DELETE ON public.login_attempts TO arcredix_owner;
GRANT USAGE, SELECT ON SEQUENCE public.login_attempts_id_seq TO arcredix_owner;
