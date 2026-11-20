-- ARCREDIX tenant Row-Level Security.
-- The application connects as arcredix_owner but switches to the NOLOGIN,
-- NOBYPASSRLS role arcredix_app at connection startup. JWT claims are supplied
-- by the Neon serverless driver authToken option and read through pg_session_jwt.

CREATE EXTENSION IF NOT EXISTS pg_session_jwt;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arcredix_app') THEN
    EXECUTE 'CREATE ROLE arcredix_app NOLOGIN NOBYPASSRLS';
  END IF;
END
$$;

ALTER ROLE arcredix_app NOLOGIN NOBYPASSRLS;
GRANT arcredix_app TO arcredix_owner;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  auth_subject text PRIMARY KEY,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_email_lower_uq
  ON public.platform_admins (lower(email));

INSERT INTO public.platform_admins (auth_subject, email, is_active)
VALUES ('d99f3638-f670-433b-9cb5-922882455962', 'cryptoarg01@gmail.com', true)
ON CONFLICT (auth_subject) DO UPDATE
SET email = EXCLUDED.email, is_active = true, updated_at = now();

CREATE OR REPLACE FUNCTION public.current_auth_subject()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.user_id()
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.auth_subject = public.current_auth_subject()
      AND pa.is_active = true
  )
$$;

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
  )
$$;

REVOKE ALL ON FUNCTION public.current_auth_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_merchant_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_merchant_role(uuid, text[]) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO arcredix_app;
GRANT EXECUTE ON FUNCTION public.current_auth_subject() TO arcredix_app;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO arcredix_app;
GRANT EXECUTE ON FUNCTION public.has_active_merchant_membership(uuid) TO arcredix_app;
GRANT EXECUTE ON FUNCTION public.has_merchant_role(uuid, text[]) TO arcredix_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_admins TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_providers TO arcredix_app;
GRANT SELECT, UPDATE ON public.merchants TO arcredix_app;
GRANT SELECT ON public.merchant_users TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_connections TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registers TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_webhook_events TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_invitations TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_outbox TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_events TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_limit_overrides TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO arcredix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_jobs TO arcredix_app;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_limit_overrides FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_access ON public.platform_admins
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY plans_public_read ON public.plans
  FOR SELECT TO arcredix_app
  USING (is_active OR public.is_platform_admin());
CREATE POLICY plans_admin_write ON public.plans
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY providers_public_read ON public.payment_providers
  FOR SELECT TO arcredix_app
  USING (is_active OR public.is_platform_admin());
CREATE POLICY providers_admin_write ON public.payment_providers
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY merchants_tenant_read ON public.merchants
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(id) OR public.is_platform_admin());
CREATE POLICY merchants_admin_access ON public.merchants
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY merchant_users_tenant_read ON public.merchant_users
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY merchant_users_admin_access ON public.merchant_users
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY payment_connections_tenant_read ON public.payment_connections
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY payment_connections_tenant_write ON public.payment_connections
  FOR ALL TO arcredix_app
  USING (public.has_merchant_role(merchant_id, ARRAY['owner','admin']) OR public.is_platform_admin())
  WITH CHECK (public.has_merchant_role(merchant_id, ARRAY['owner','admin']) OR public.is_platform_admin());

CREATE POLICY registers_tenant_read ON public.registers
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY registers_tenant_write ON public.registers
  FOR ALL TO arcredix_app
  USING (public.has_merchant_role(merchant_id, ARRAY['owner','admin','manager','operator']) OR public.is_platform_admin())
  WITH CHECK (public.has_merchant_role(merchant_id, ARRAY['owner','admin','manager','operator']) OR public.is_platform_admin());

CREATE POLICY qr_codes_tenant_read ON public.qr_codes
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY qr_codes_tenant_write ON public.qr_codes
  FOR ALL TO arcredix_app
  USING (public.has_merchant_role(merchant_id, ARRAY['owner','admin','manager']) OR public.is_platform_admin())
  WITH CHECK (public.has_merchant_role(merchant_id, ARRAY['owner','admin','manager']) OR public.is_platform_admin());

CREATE POLICY subscriptions_tenant_read ON public.subscriptions
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY subscriptions_admin_access ON public.subscriptions
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY audit_logs_tenant_read ON public.audit_logs
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY audit_logs_admin_access ON public.audit_logs
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY payment_transactions_tenant_read ON public.payment_transactions
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY payment_transactions_admin_access ON public.payment_transactions
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY webhook_events_admin_access ON public.payment_webhook_events
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY merchant_invitations_tenant_access ON public.merchant_invitations
  FOR ALL TO arcredix_app
  USING (public.has_merchant_role(merchant_id, ARRAY['owner','admin']) OR public.is_platform_admin())
  WITH CHECK (public.has_merchant_role(merchant_id, ARRAY['owner','admin']) OR public.is_platform_admin());

CREATE POLICY notification_outbox_admin_access ON public.notification_outbox
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY subscription_events_tenant_read ON public.subscription_events
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY subscription_events_admin_access ON public.subscription_events
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY merchant_limit_overrides_admin_access ON public.merchant_limit_overrides
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY subscription_payments_tenant_read ON public.subscription_payments
  FOR SELECT TO arcredix_app
  USING (public.has_active_merchant_membership(merchant_id) OR public.is_platform_admin());
CREATE POLICY subscription_payments_admin_access ON public.subscription_payments
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY scheduled_jobs_admin_access ON public.scheduled_jobs
  FOR ALL TO arcredix_app
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
