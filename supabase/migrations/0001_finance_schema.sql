-- Sprint 01: Finance Schema Migration

-- Extend inbound_messages with parse fields
ALTER TABLE inbound_messages
  ADD COLUMN IF NOT EXISTS parsed_json JSONB,
  ADD COLUMN IF NOT EXISTS skill TEXT;

-- Accounts (efectivo, qr)
CREATE TABLE IF NOT EXISTS accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories (configurable)
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  icon       TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount_bs           NUMERIC(12, 2) NOT NULL CHECK (amount_bs > 0),
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  note                TEXT,
  source              TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('whatsapp', 'web')),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  inbound_message_id  UUID REFERENCES inbound_messages(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

-- Login attempts for rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);
