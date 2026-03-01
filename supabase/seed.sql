-- Coki: Seed Data
-- Default settings/config values (operational, editable from UI)
-- NOTE: No real PIN is seeded here — run the seed-admin script to create a user.

INSERT INTO settings (key, value, description) VALUES
  ('timezone',            'America/Caracas', 'Default timezone for date/time operations'),
  ('daily_summary_time',  '08:00',           'Time to send daily summary (HH:MM, local timezone)'),
  ('whatsapp_number',     '',                'Your WhatsApp number to receive messages (E.164 format)'),
  ('currency',            'USD',             'Default currency code (ISO 4217)'),
  ('budget_monthly',      '0',               'Monthly budget cap in default currency'),
  ('ai_model',            'qwen-3-32b',      'Cerebras model identifier to use for completions'),
  ('ai_system_prompt',    'Eres Coki, un asistente personal inteligente. Responde de forma concisa y útil.', 'System prompt for AI completions'),
  ('feature_finance',     'false',           'Enable finance skill'),
  ('feature_tasks',       'false',           'Enable tasks skill'),
  ('feature_docs',        'false',           'Enable docs skill')
ON CONFLICT (key) DO NOTHING;
