-- Use a server-verified identity context for RLS.
-- The app verifies Neon Auth JWT signature, issuer and expiry before setting
-- this transaction-local value while running as the NOLOGIN arcredix_app role.
CREATE OR REPLACE FUNCTION public.current_auth_subject()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT nullif(current_setting('arc.auth_subject', true), '')
$$;

REVOKE ALL ON FUNCTION public.current_auth_subject() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_auth_subject() TO arcredix_app;
