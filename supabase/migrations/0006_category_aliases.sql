-- Sprint 3.1: Learned category aliases from WhatsApp corrections

CREATE TABLE IF NOT EXISTS category_aliases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  alias_text       TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'draft_category_selection'
                     CHECK (source IN ('draft_category_selection', 'manual')),
  usage_count      INT NOT NULL DEFAULT 1 CHECK (usage_count > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_category_aliases_category
  ON category_aliases(category_id);

CREATE INDEX IF NOT EXISTS idx_category_aliases_normalized
  ON category_aliases(normalized_alias);
