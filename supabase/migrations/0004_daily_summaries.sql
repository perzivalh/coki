-- Sprint 02 fix: daily_summaries table (missing from previous migrations)
-- Paste this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS daily_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  payload_json    JSONB,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_date
  ON daily_summaries(date DESC);
