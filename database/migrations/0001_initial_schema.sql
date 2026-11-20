-- ARCREDIX initial schema.
-- Safe to re-run: objects are created only when missing; catalog seeds are upserted.
-- Application traffic uses DATABASE_URL (pooled). Use DATABASE_URL_UNPOOLED for future migrations.

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  monthly_price_usd numeric NOT NULL CHECK (monthly_price_usd >= 0),
  connection_limit integer CHECK (connection_limit IS NULL OR connection_limit > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trade_name text,
  tax_id text,
  owner_name text,
  email text NOT NULL,
  phone text,
  whatsapp_phone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
  timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS merchants_email_lower_uq ON public.merchants (lower(email));

CREATE TABLE IF NOT EXISTS public.merchant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  auth_subject text UNIQUE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'manager', 'operator', 'viewer')),
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'disabled')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, email)
);

CREATE TABLE IF NOT EXISTS public.payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'payment_gateway',
  is_active boolean NOT NULL DEFAULT true,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.payment_providers(id),
  display_name text NOT NULL,
  account_reference text,
  account_alias text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'error', 'disconnected')),
  credential_reference text,
  last_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_connections_merchant_idx
  ON public.payment_connections (merchant_id, status);

CREATE TABLE IF NOT EXISTS public.registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, name),
  UNIQUE (merchant_id, code)
);

CREATE TABLE IF NOT EXISTS public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  payment_connection_id uuid NOT NULL REFERENCES public.payment_connections(id),
  register_id uuid REFERENCES public.registers(id) ON DELETE SET NULL,
  label text NOT NULL,
  qr_type text NOT NULL DEFAULT 'static' CHECK (qr_type IN ('static', 'dynamic')),
  sharing_mode text NOT NULL DEFAULT 'exclusive' CHECK (sharing_mode IN ('exclusive', 'shared')),
  payload text NOT NULL,
  provider_qr_reference text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qr_codes_merchant_idx ON public.qr_codes (merchant_id, status);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired')),
  billing_interval text NOT NULL DEFAULT 'month'
    CHECK (billing_interval IN ('month', 'year', 'one_time')),
  price_usd numeric NOT NULL CHECK (price_usd >= 0),
  starts_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start)
);
CREATE INDEX IF NOT EXISTS subscriptions_merchant_status_idx
  ON public.subscriptions (merchant_id, status, current_period_end DESC);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_current_per_merchant_uq
  ON public.subscriptions (merchant_id)
  WHERE status IN ('pending', 'trialing', 'active', 'past_due', 'grace_period', 'suspended');

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.merchant_users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('system', 'merchant_user', 'superadmin', 'webhook')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_merchant_created_idx
  ON public.audit_logs (merchant_id, created_at DESC);

-- Confirmed commercial catalog. Do not count registers or QR codes as connections.
INSERT INTO public.plans (code, name, monthly_price_usd, connection_limit)
VALUES
  ('starter', 'Starter', 15, 3),
  ('growth', 'Growth', 29, 5),
  ('business', 'Business', 55, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_usd = EXCLUDED.monthly_price_usd,
  connection_limit = EXCLUDED.connection_limit,
  updated_at = now();

INSERT INTO public.payment_providers (code, name, capabilities)
VALUES
  ('mercado_pago', 'Mercado Pago', '{"webhooks":true,"qr_static":true,"qr_dynamic":true}'::jsonb),
  ('other', 'Otro proveedor', '{}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  capabilities = EXCLUDED.capabilities;
