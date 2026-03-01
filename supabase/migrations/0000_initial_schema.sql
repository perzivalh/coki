-- Coki: Initial Schema Migration
-- Sprint 0 — tables: settings, sessions, inbound_messages, users

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id TEXT NOT NULL UNIQUE,
  from_number   TEXT NOT NULL,
  message_type  TEXT NOT NULL,
  body          TEXT,
  raw_payload   JSONB,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_inbound_messages_from ON inbound_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_processed ON inbound_messages(processed);
