-- Sprint 2.5: Config Finance 2.0 + Guided WhatsApp Capture (no assumptions)
-- Paste this in Supabase SQL Editor

-- =========================================================
-- 1) Extend transactions: add 'draft' to status + bucket
-- =========================================================

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'draft'));

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'free'
    CHECK (bucket IN ('free', 'fixed'));

-- =========================================================
-- 2) income_sources — monthly income definitions
-- =========================================================
CREATE TABLE IF NOT EXISTS income_sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  amount_monthly_bs NUMERIC(12, 2) NOT NULL CHECK (amount_monthly_bs > 0),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 3) fixed_bills — recurring monthly bills
-- =========================================================
CREATE TABLE IF NOT EXISTS fixed_bills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  amount_bs  NUMERIC(12, 2) NOT NULL CHECK (amount_bs > 0),
  due_day    INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  autopay    BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 4) account_balances — one balance record per account
-- =========================================================
CREATE TABLE IF NOT EXISTS account_balances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance_bs NUMERIC(12, 2) NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'manual'
               CHECK (source IN ('manual', 'adjustment', 'system')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_account_id
  ON account_balances(account_id);

-- =========================================================
-- 5) draft_transactions — incomplete bot-captured entries
-- =========================================================
CREATE TABLE IF NOT EXISTS draft_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_input      TEXT,
  parsed_json    JSONB,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'complete', 'abandoned')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_transactions_status
  ON draft_transactions(status, expires_at DESC);

-- =========================================================
-- 6) bot_pending_steps — state machine for WA interactive flow
-- =========================================================
CREATE TABLE IF NOT EXISTS bot_pending_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id         UUID NOT NULL REFERENCES draft_transactions(id) ON DELETE CASCADE,
  step_type        TEXT NOT NULL
                     CHECK (step_type IN ('ask_type', 'ask_category', 'ask_account', 'confirm')),
  message_context  JSONB,   -- { from: string, wa_message_id?: string }
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_pending_steps_draft_id
  ON bot_pending_steps(draft_id);

-- =========================================================
-- 7) attachments — audio/image associated with drafts
-- =========================================================
CREATE TABLE IF NOT EXISTS attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id          UUID REFERENCES draft_transactions(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('audio', 'image')),
  provider_media_id TEXT NOT NULL,
  extracted_text    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 8) Seed default account balances for existing accounts
-- =========================================================
INSERT INTO account_balances (account_id, balance_bs, source)
SELECT id, 0, 'system'
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM account_balances ab WHERE ab.account_id = accounts.id
);
