-- aefi canonical events + indexer cursor (scaffold #1)
-- Applied via docker-compose init or manually.

CREATE TABLE IF NOT EXISTS indexer_cursor (
  chain_id      BIGINT PRIMARY KEY,
  last_block    BIGINT NOT NULL DEFAULT 0,
  last_log_index INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evt_base (
  id            TEXT PRIMARY KEY,
  chain_id      BIGINT NOT NULL,
  block_number  BIGINT NOT NULL,
  block_hash    TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  log_index     INTEGER NOT NULL,
  address       TEXT NOT NULL,
  topic0        TEXT,
  event_name    TEXT NOT NULL,
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_topics    TEXT[] NOT NULL DEFAULT '{}',
  raw_data      TEXT NOT NULL DEFAULT '',
  decoded       JSONB NOT NULL DEFAULT '{}',
  schema_version TEXT NOT NULL DEFAULT '0.1.0',
  UNIQUE (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS evt_base_block_idx
  ON evt_base (chain_id, block_number, log_index);

CREATE TABLE IF NOT EXISTS evt_transfer (
  id            TEXT PRIMARY KEY REFERENCES evt_base(id) ON DELETE CASCADE,
  from_addr     TEXT NOT NULL,
  to_addr       TEXT NOT NULL,
  value         NUMERIC NOT NULL,
  decimals      INTEGER NOT NULL,
  emitter_role  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evt_memo (
  id              TEXT PRIMARY KEY REFERENCES evt_base(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL,
  memo_id         TEXT,
  payload         TEXT,
  call_data_hash  TEXT
);

CREATE TABLE IF NOT EXISTS evt_erc8004 (
  id            TEXT PRIMARY KEY REFERENCES evt_base(id) ON DELETE CASCADE,
  registry      TEXT NOT NULL,
  event_kind    TEXT NOT NULL,
  agent_id      TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS evt_erc8183 (
  id            TEXT PRIMARY KEY REFERENCES evt_base(id) ON DELETE CASCADE,
  job_id        TEXT NOT NULL,
  event_kind    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS evt_gateway (
  id                   TEXT PRIMARY KEY REFERENCES evt_base(id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL,
  transfer_spec_hash   TEXT,
  delegate             TEXT,
  payload              JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS evt_cctp (
  id            TEXT PRIMARY KEY REFERENCES evt_base(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS evt_offchain_receipt (
  id              TEXT PRIMARY KEY,
  protocol        TEXT NOT NULL,
  receipt_id      TEXT NOT NULL,
  auth_payload    JSONB NOT NULL DEFAULT '{}',
  settle_tx_hash  TEXT,
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_version  TEXT NOT NULL DEFAULT '0.1.0',
  UNIQUE (protocol, receipt_id)
);
