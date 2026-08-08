-- Matcher projection watermark (Postgres is source of truth for how far we projected).
CREATE TABLE IF NOT EXISTS matcher_cursor (
  id              TEXT PRIMARY KEY DEFAULT 'neo4j',
  last_block      BIGINT NOT NULL DEFAULT 0,
  last_log_index  INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO matcher_cursor (id, last_block, last_log_index)
VALUES ('neo4j', 0, 0)
ON CONFLICT (id) DO NOTHING;
