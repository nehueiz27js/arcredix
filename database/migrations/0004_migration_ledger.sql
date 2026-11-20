-- ARCREDIX migration ledger bootstrap.
-- This migration is intentionally additive and validates the already-applied schema
-- before recording migrations 0001-0003 as the historical baseline.

DO $$
DECLARE
  missing_tables text[];
  missing_constraints text[];
BEGIN
  SELECT array_agg(required.name)
    INTO missing_tables
  FROM unnest(ARRAY[
    'audit_logs', 'merchant_invitations', 'merchant_limit_overrides',
    'merchant_users', 'merchants', 'notification_outbox',
    'payment_connections', 'payment_providers', 'payment_transactions',
    'payment_webhook_events', 'plans', 'qr_codes', 'registers',
    'scheduled_jobs', 'subscription_events', 'subscription_payments',
    'subscriptions'
  ]) AS required(name)
  WHERE to_regclass(format('public.%I', required.name)) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot baseline ARCREDIX migrations: missing tables: %', missing_tables;
  END IF;

  SELECT array_agg(required.name)
    INTO missing_constraints
  FROM unnest(ARRAY[
    'merchant_users_id_merchant_uq',
    'payment_connections_id_merchant_uq',
    'registers_id_merchant_uq',
    'qr_codes_id_merchant_uq',
    'subscriptions_id_merchant_uq',
    'qr_codes_connection_tenant_fk',
    'qr_codes_register_tenant_fk',
    'subscription_payments_subscription_tenant_fk',
    'payment_transactions_connection_tenant_fk',
    'payment_transactions_register_tenant_fk',
    'payment_transactions_qr_tenant_fk',
    'subscription_events_subscription_tenant_fk',
    'audit_logs_actor_tenant_fk'
  ]) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = required.name
      AND c.connamespace = 'public'::regnamespace
  );

  IF missing_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot baseline ARCREDIX migrations: missing constraints: %', missing_constraints;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version varchar(20) PRIMARY KEY,
  migration_name text NOT NULL,
  checksum char(40) NOT NULL CHECK (checksum ~ '^[0-9a-f]{40}$'),
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user
);

INSERT INTO public.schema_migrations (version, migration_name, checksum)
VALUES
  ('0001', 'initial_schema', '0dcfceb3fca902e627f4b71c2886391929236898'),
  ('0002', 'operational_core', '54496728ef7616cba4f0b1ac5e913081d8f08152'),
  ('0003', 'tenant_integrity_and_billing', '9b34233a2d1c2e143d0e4974e1006281d76eb52')
ON CONFLICT (version) DO NOTHING;
