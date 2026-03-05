-- Sprint 3: WhatsApp Conversation Pro
-- Isolate pending drafts/confirmations by sender phone number.

-- 1) Drafts must be tied to sender number.
ALTER TABLE draft_transactions
  ADD COLUMN IF NOT EXISTS from_number TEXT;

-- Backfill from bot step context when available.
UPDATE draft_transactions d
SET from_number = b.message_context ->> 'from'
FROM bot_pending_steps b
WHERE b.draft_id = d.id
  AND d.from_number IS NULL
  AND (b.message_context ->> 'from') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_draft_transactions_from_status_created
  ON draft_transactions(from_number, status, created_at DESC);

-- 2) Transactions from WhatsApp must be tied to sender number.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS from_number TEXT;

-- Backfill from inbound messages if linked.
UPDATE transactions t
SET from_number = im.from_number
FROM inbound_messages im
WHERE t.inbound_message_id = im.id
  AND t.from_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_from_status_occurred
  ON transactions(from_number, status, occurred_at DESC);
