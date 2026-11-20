-- ARCREDIX tenant integrity and billing scheduler.
-- Adds database-enforced tenant consistency to cross-table references.
-- Adds a separate ledger for payments collected by ARCREDIX for subscriptions.

ALTER TABLE public.merchant_users
  ADD CONSTRAINT merchant_users_id_merchant_uq UNIQUE (id, merchant_id);

ALTER TABLE public.payment_connections
  ADD CONSTRAINT payment_connections_id_merchant_uq UNIQUE (id, merchant_id);

ALTER TABLE public.registers
  ADD CONSTRAINT registers_id_merchant_uq UNIQUE (id, merchant_id);

ALTER TABLE public.qr_codes
  ADD CONSTRAINT qr_codes_id_merchant_uq UNIQUE (id, merchant_id);

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_id_merchant_uq UNIQUE (id, merchant_id);

ALTER TABLE public.qr_codes
  ADD CONSTRAINT qr_codes_connection_tenant_fk
  FOREIGN KEY (payment_connection_id, merchant_id)
  REFERENCES public.payment_connections (id, merchant_id);

ALTER TABLE public.qr_codes
  ADD CONSTRAINT qr_codes_register_tenant_fk
  FOREIGN KEY (register_id, merchant_id)
  REFERENCES public.registers (id, merchant_id);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id),
  provider_payment_id text,
  external_reference text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'unknown')),
  provider_status text,
  payment_method text,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_payments_subscription_tenant_fk
    FOREIGN KEY (subscription_id, merchant_id)
    REFERENCES public.subscriptions (id, merchant_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_payment_uq
  ON public.subscription_payments (provider_id, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_payments_merchant_created_idx
  ON public.subscription_payments (merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx
  ON public.scheduled_jobs (run_at, created_at)
  WHERE status IN ('queued', 'failed');

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_connection_tenant_fk
  FOREIGN KEY (payment_connection_id, merchant_id)
  REFERENCES public.payment_connections (id, merchant_id);

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_register_tenant_fk
  FOREIGN KEY (register_id, merchant_id)
  REFERENCES public.registers (id, merchant_id);

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_qr_tenant_fk
  FOREIGN KEY (qr_code_id, merchant_id)
  REFERENCES public.qr_codes (id, merchant_id);

ALTER TABLE public.subscription_events
  ADD CONSTRAINT subscription_events_subscription_tenant_fk
  FOREIGN KEY (subscription_id, merchant_id)
  REFERENCES public.subscriptions (id, merchant_id)
  ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_tenant_fk
  FOREIGN KEY (actor_user_id, merchant_id)
  REFERENCES public.merchant_users (id, merchant_id);
