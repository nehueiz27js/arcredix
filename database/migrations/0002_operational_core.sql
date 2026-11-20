-- ARCREDIX operational core: payment traceability, webhook idempotency,
-- secure invitations, notification outbox, subscription history and per-merchant limits.
-- Additive migration. Never stores provider access tokens or raw webhook bodies.

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  payment_connection_id uuid NOT NULL REFERENCES public.payment_connections(id),
  register_id uuid REFERENCES public.registers(id) ON DELETE SET NULL,
  qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  provider_payment_id text,
  external_reference text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'ARS',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'unknown')),
  payment_method text,
  payer_reference text,
  provider_status text,
  occurred_at timestamptz,
  confirmed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_connection_id, external_reference)
);

CREATE INDEX IF NOT EXISTS payment_transactions_merchant_created_idx
  ON public.payment_transactions (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_merchant_status_idx
  ON public.payment_transactions (merchant_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_payment_uq
  ON public.payment_transactions (payment_connection_id, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id),
  payment_connection_id uuid REFERENCES public.payment_connections(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_status_idx
  ON public.payment_webhook_events (processing_status, received_at);

CREATE TABLE IF NOT EXISTS public.merchant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'operator'
    CHECK (role IN ('owner', 'admin', 'manager', 'operator', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  invited_by text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_invitations_merchant_email_idx
  ON public.merchant_invitations (merchant_id, lower(email), created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  recipient text NOT NULL,
  template_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_outbox_due_idx
  ON public.notification_outbox (scheduled_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'superadmin', 'webhook', 'merchant_user')),
  actor_reference text,
  event_type text NOT NULL,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_merchant_created_idx
  ON public.subscription_events (merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_limit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  connection_limit integer CHECK (connection_limit IS NULL OR connection_limit > 0),
  register_limit integer CHECK (register_limit IS NULL OR register_limit > 0),
  user_limit integer CHECK (user_limit IS NULL OR user_limit > 0),
  qr_limit integer CHECK (qr_limit IS NULL OR qr_limit > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  set_by text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id)
);

CREATE INDEX IF NOT EXISTS merchant_limit_overrides_expires_idx
  ON public.merchant_limit_overrides (expires_at)
  WHERE expires_at IS NOT NULL;
