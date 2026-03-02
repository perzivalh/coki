-- Sprint 02: Límites, Confirmaciones, Resumen Diario, Edición de Transacciones
-- Paste this in Supabase SQL Editor

-- 1) Extend transactions with sprint02 fields
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS exceeded_daily     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exceeded_monthly   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exceeded_category  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;

-- Update status check to include pending/cancelled
ALTER TABLE transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- Update existing 'confirmed' rows (already valid, just ensure constraint is fresh)
-- (no-op since 'confirmed' is still valid)

-- 2) Budgets (singleton row for the single owner)
CREATE TABLE IF NOT EXISTS budgets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_total_bs NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_total_bs >= 0),
  daily_free_bs    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (daily_free_bs >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed a default row if none exists
INSERT INTO budgets (monthly_total_bs, daily_free_bs) 
SELECT 0, 0
WHERE NOT EXISTS (SELECT 1 FROM budgets);

-- 3) Per-category limits
CREATE TABLE IF NOT EXISTS category_budgets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  monthly_limit_bs NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_limit_bs >= 0),
  active           BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(category_id)
);

-- 4) Daily summary delivery log
CREATE TABLE IF NOT EXISTS daily_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  sent_at         TIMESTAMPTZ,
  payload_json    JSONB,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);
