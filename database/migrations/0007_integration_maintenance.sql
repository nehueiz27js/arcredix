-- Scheduled maintenance for OAuth credentials and Gmail push subscriptions.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='arcredix_webhook') THEN
    EXECUTE 'CREATE ROLE arcredix_webhook NOLOGIN NOBYPASSRLS';
  END IF;
END $$;
GRANT arcredix_webhook TO arcredix_owner;
GRANT USAGE ON SCHEMA public TO arcredix_webhook;

CREATE OR REPLACE FUNCTION public.arcredix_list_gmail_watches()
RETURNS TABLE (
  connection_id uuid, ciphertext text, iv text, auth_tag text,
  key_version integer, metadata jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT pc.id,pcs.ciphertext,pcs.iv,pcs.auth_tag,pcs.key_version,pc.metadata
  FROM public.payment_connections pc
  JOIN public.payment_providers pp ON pp.id=pc.provider_id
  JOIN public.payment_connection_secrets pcs ON pcs.payment_connection_id=pc.id
    AND pcs.merchant_id=pc.merchant_id
  WHERE pp.code='bank_gmail' AND pc.status='active'
    AND (
      nullif(pc.metadata->>'gmail_watch_expiration','') IS NULL
      OR to_timestamp((pc.metadata->>'gmail_watch_expiration')::numeric / 1000.0) < now() + interval '1 day'
    )
$$;

CREATE OR REPLACE FUNCTION public.arcredix_update_mp_secret(
  p_connection_id uuid,p_ciphertext text,p_iv text,p_auth_tag text,p_key_version integer
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.payment_connection_secrets pcs
  SET ciphertext=p_ciphertext,iv=p_iv,auth_tag=p_auth_tag,key_version=p_key_version,updated_at=now()
  FROM public.payment_providers pp,public.payment_connections pc
  WHERE pc.id=p_connection_id AND pp.id=pc.provider_id AND pp.code='mercado_pago'
    AND pcs.payment_connection_id=pc.id AND pcs.merchant_id=pc.merchant_id;
  RETURN FOUND;
END
$$;

REVOKE ALL ON FUNCTION public.arcredix_list_gmail_watches() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arcredix_update_mp_secret(uuid,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arcredix_list_gmail_watches() TO arcredix_webhook;
GRANT EXECUTE ON FUNCTION public.arcredix_update_mp_secret(uuid,text,text,text,integer) TO arcredix_webhook;
