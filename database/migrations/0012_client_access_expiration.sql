-- Optional client access-code expiration, enforced on every tenant query.
ALTER TABLE public.merchant_users
  ADD COLUMN IF NOT EXISTS access_key_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.has_active_merchant_membership(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchant_users mu
    INNER JOIN public.merchants m ON m.id = mu.merchant_id
    WHERE mu.merchant_id = p_merchant_id
      AND mu.auth_subject = public.current_auth_subject()
      AND mu.status = 'active'
      AND m.status = 'active'
      AND (mu.access_key_expires_at IS NULL OR mu.access_key_expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.has_merchant_role(p_merchant_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchant_users mu
    INNER JOIN public.merchants m ON m.id = mu.merchant_id
    WHERE mu.merchant_id = p_merchant_id
      AND mu.auth_subject = public.current_auth_subject()
      AND mu.status = 'active'
      AND m.status = 'active'
      AND mu.role = ANY (p_roles)
      AND (mu.access_key_expires_at IS NULL OR mu.access_key_expires_at > now())
  )
$$;
