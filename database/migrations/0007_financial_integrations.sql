-- ARCREDIX financial integrations: Gmail notifications + payment provider credentials.
-- Additive migration. Secrets are encrypted by the application before persistence.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='arcredix_webhook') THEN
    EXECUTE 'CREATE ROLE arcredix_webhook NOLOGIN NOBYPASSRLS';
  END IF;
END $$;
GRANT arcredix_webhook TO arcredix_owner;
GRANT USAGE ON SCHEMA public TO arcredix_webhook;

INSERT INTO public.payment_providers (code, name, provider_type, is_active, capabilities)
VALUES
  ('mercado_pago', 'Mercado Pago', 'payment_gateway', true,
   '{"authorization":"oauth","webhooks":true,"payment_lookup":true,"account_movements_api":false}'::jsonb),
  ('uala_bis', 'Ualá Bis', 'payment_gateway', true,
   '{"authorization":"provider_review_required","webhooks":true,"payment_lookup":true,"account_movements_api":false}'::jsonb),
  ('bank_gmail', 'Bancos por Gmail', 'bank_notification', true,
   '{"authorization":"google_oauth","gmail_watch":true,"pubsub":true,"payment_confirmation":"evidence_only"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, provider_type = EXCLUDED.provider_type,
  is_active = EXCLUDED.is_active, capabilities = EXCLUDED.capabilities;

CREATE TABLE IF NOT EXISTS public.payment_connection_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  payment_connection_id uuid NOT NULL,
  ciphertext text NOT NULL, iv text NOT NULL, auth_tag text NOT NULL,
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_connection_secrets_connection_uq UNIQUE (payment_connection_id),
  CONSTRAINT payment_connection_secrets_tenant_fk
    FOREIGN KEY (payment_connection_id, merchant_id)
    REFERENCES public.payment_connections (id, merchant_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS payment_connection_secrets_merchant_idx
  ON public.payment_connection_secrets (merchant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_connection_secrets TO arcredix_app;
ALTER TABLE public.payment_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_connection_secrets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_connection_secrets_tenant_access ON public.payment_connection_secrets;
CREATE POLICY payment_connection_secrets_tenant_access
  ON public.payment_connection_secrets FOR ALL TO arcredix_app
  USING (public.has_merchant_role(merchant_id, ARRAY['owner','admin']) OR public.is_platform_admin())
  WITH CHECK (public.has_merchant_role(merchant_id, ARRAY['owner','admin']) OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.arcredix_resolve_gmail_push(p_email text)
RETURNS TABLE (connection_id uuid, merchant_id uuid, ciphertext text, iv text, auth_tag text, key_version integer, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT pc.id, pc.merchant_id, pcs.ciphertext, pcs.iv, pcs.auth_tag, pcs.key_version, pc.metadata
  FROM public.payment_connections pc
  JOIN public.payment_providers pp ON pp.id = pc.provider_id
  JOIN public.payment_connection_secrets pcs ON pcs.payment_connection_id = pc.id AND pcs.merchant_id = pc.merchant_id
  WHERE pp.code = 'bank_gmail' AND pc.status = 'active' AND lower(pc.account_reference) = lower(p_email)
  ORDER BY pc.updated_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.arcredix_update_gmail_watch(p_connection_id uuid, p_history_id text, p_expiration text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.payment_connections pc
  SET metadata = pc.metadata || jsonb_build_object('gmail_history_id',p_history_id,
        'gmail_watch_expiration',p_expiration,'gmail_watch_status','active','last_sync_at',now()),
      status='active', last_verified_at=now(), updated_at=now()
  FROM public.payment_providers pp
  WHERE pc.id=p_connection_id AND pp.id=pc.provider_id AND pp.code='bank_gmail';
  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION public.arcredix_record_gmail_notice(
  p_connection_id uuid, p_message_id text, p_amount numeric, p_currency text,
  p_sender text, p_subject text, p_occurred_at timestamptz
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_merchant_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount<=0 OR p_currency !~ '^[A-Z]{3}$'
     OR p_message_id IS NULL OR length(p_message_id)>500 THEN RETURN false; END IF;
  SELECT pc.merchant_id INTO v_merchant_id
  FROM public.payment_connections pc JOIN public.payment_providers pp ON pp.id=pc.provider_id
  WHERE pc.id=p_connection_id AND pp.code='bank_gmail' AND pc.status='active';
  IF v_merchant_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.payment_transactions (
    merchant_id,payment_connection_id,external_reference,amount,currency,status,
    payment_method,payer_reference,provider_status,occurred_at,metadata
  ) VALUES (
    v_merchant_id,p_connection_id,'gmail:'||p_message_id,p_amount,p_currency,'unknown',
    'bank_email',left(coalesce(p_sender,''),255),'email_notice_unverified',p_occurred_at,
    jsonb_build_object('source','gmail','email_message_id',p_message_id,
      'email_sender',left(coalesce(p_sender,''),255),'email_subject',left(coalesce(p_subject,''),500),
      'requires_bank_or_wallet_confirmation',true)
  ) ON CONFLICT (payment_connection_id,external_reference) DO NOTHING;
  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION public.arcredix_resolve_mp_connection(p_provider_user_id text)
RETURNS TABLE (connection_id uuid, merchant_id uuid, ciphertext text, iv text, auth_tag text, key_version integer, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT pc.id,pc.merchant_id,pcs.ciphertext,pcs.iv,pcs.auth_tag,pcs.key_version,pc.metadata
  FROM public.payment_connections pc
  JOIN public.payment_providers pp ON pp.id=pc.provider_id
  JOIN public.payment_connection_secrets pcs ON pcs.payment_connection_id=pc.id AND pcs.merchant_id=pc.merchant_id
  WHERE pp.code='mercado_pago' AND pc.status='active' AND pc.account_reference=p_provider_user_id
  ORDER BY pc.updated_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.arcredix_record_mp_payment(
  p_connection_id uuid,p_payment_id text,p_external_reference text,p_amount numeric,
  p_currency text,p_status text,p_method text,p_payer text,p_provider_status text,
  p_occurred_at timestamptz,p_confirmed_at timestamptz
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_merchant_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount<=0 OR p_currency !~ '^[A-Z]{3}$'
     OR p_status NOT IN ('approved','pending','rejected','cancelled','refunded','unknown')
     OR p_payment_id IS NULL THEN RETURN false; END IF;
  SELECT pc.merchant_id INTO v_merchant_id
  FROM public.payment_connections pc JOIN public.payment_providers pp ON pp.id=pc.provider_id
  WHERE pc.id=p_connection_id AND pp.code='mercado_pago' AND pc.status='active';
  IF v_merchant_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.payment_transactions (
    merchant_id,payment_connection_id,provider_payment_id,external_reference,amount,currency,
    status,payment_method,payer_reference,provider_status,occurred_at,confirmed_at,metadata
  ) VALUES (
    v_merchant_id,p_connection_id,p_payment_id,coalesce(nullif(p_external_reference,''),'mp:'||p_payment_id),
    p_amount,p_currency,p_status,p_method,left(coalesce(p_payer,''),255),p_provider_status,
    p_occurred_at,p_confirmed_at,jsonb_build_object('source','mercado_pago','provider_api_verified',true)
  )
  ON CONFLICT (payment_connection_id,provider_payment_id) WHERE provider_payment_id IS NOT NULL
  DO UPDATE SET status=EXCLUDED.status,provider_status=EXCLUDED.provider_status,
    amount=EXCLUDED.amount,currency=EXCLUDED.currency,confirmed_at=EXCLUDED.confirmed_at,
    updated_at=now(),metadata=public.payment_transactions.metadata || EXCLUDED.metadata;
  RETURN FOUND;
END
$$;

REVOKE ALL ON FUNCTION public.arcredix_resolve_gmail_push(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arcredix_update_gmail_watch(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arcredix_record_gmail_notice(uuid,text,numeric,text,text,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arcredix_resolve_mp_connection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arcredix_record_mp_payment(uuid,text,text,numeric,text,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arcredix_resolve_gmail_push(text) TO arcredix_webhook;
GRANT EXECUTE ON FUNCTION public.arcredix_update_gmail_watch(uuid,text,text) TO arcredix_webhook;
GRANT EXECUTE ON FUNCTION public.arcredix_record_gmail_notice(uuid,text,numeric,text,text,text,timestamptz) TO arcredix_webhook;
GRANT EXECUTE ON FUNCTION public.arcredix_resolve_mp_connection(text) TO arcredix_webhook;
GRANT EXECUTE ON FUNCTION public.arcredix_record_mp_payment(uuid,text,text,numeric,text,text,text,text,text,timestamptz,timestamptz) TO arcredix_webhook;

COMMENT ON TABLE public.payment_connection_secrets IS 'AES-256-GCM encrypted OAuth credentials. Plaintext credentials must never be stored here.';
COMMENT ON FUNCTION public.arcredix_record_gmail_notice(uuid,text,numeric,text,text,text,timestamptz) IS 'Persists an email notice as unknown/unverified evidence. It never approves a payment.';
