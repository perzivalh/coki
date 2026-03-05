-- Coki: Seed Data (Sprint 01 update)

-- Accounts
INSERT INTO accounts (id, name, slug) VALUES
  (gen_random_uuid(), 'Efectivo', 'cash'),
  (gen_random_uuid(), 'QR', 'qr')
ON CONFLICT (slug) DO NOTHING;

-- Categories
INSERT INTO categories (id, name, slug, icon) VALUES
  (gen_random_uuid(), 'Comida',       'comida',        '🍔'),
  (gen_random_uuid(), 'Transporte',   'transporte',    '🚗'),
  (gen_random_uuid(), 'Salud',        'salud',         '💊'),
  (gen_random_uuid(), 'Compras',      'compras',       '🛒'),
  (gen_random_uuid(), 'Ocio',         'ocio',          '🎮'),
  (gen_random_uuid(), 'Servicios',    'servicios',     '⚡'),
  (gen_random_uuid(), 'Otros',        'otros',         '📦'),
  (gen_random_uuid(), 'Sin categoría','sin-categoria', '❓')
ON CONFLICT (slug) DO NOTHING;

-- Default settings (timezone + operational config)
INSERT INTO settings (key, value, description) VALUES
  ('timezone',            'America/La_Paz', 'Zona horaria para cálculos de fechas'),
  ('daily_summary_time',  '08:00',          'Hora de envío del resumen diario (HH:MM)'),
  ('whatsapp_number',     '',               'Número WhatsApp del Owner (E.164)'),
  ('currency',            'Bs',             'Moneda base del sistema'),
  ('ai_model',            'qwen-3-32b',     'Modelo Cerebras para IA'),
  ('ai_system_prompt',    'Eres Coki, un asistente personal financiero. Responde de forma concisa.', 'Prompt sistema para IA'),
  ('feature_finance',     'true',           'Habilitar skill de finanzas'),
  ('feature_nlu_v2',      'true',           'Habilitar parser conversacional NLU v2'),
  ('feature_tasks',       'false',          'Habilitar skill de tareas'),
  ('feature_docs',        'false',          'Habilitar skill de documentos')
ON CONFLICT (key) DO NOTHING;
