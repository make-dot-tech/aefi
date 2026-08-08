-- Lookup indexes for Wave A correlators / API
CREATE INDEX IF NOT EXISTS evt_memo_memo_id_idx ON evt_memo (memo_id);
CREATE INDEX IF NOT EXISTS evt_memo_sender_idx ON evt_memo (sender);
CREATE INDEX IF NOT EXISTS evt_transfer_tx_idx ON evt_transfer (id);
CREATE INDEX IF NOT EXISTS evt_base_tx_hash_idx ON evt_base (chain_id, tx_hash);
CREATE INDEX IF NOT EXISTS evt_erc8183_job_id_idx ON evt_erc8183 (job_id);
CREATE INDEX IF NOT EXISTS evt_erc8183_kind_idx ON evt_erc8183 (event_kind);
CREATE INDEX IF NOT EXISTS evt_erc8004_agent_id_idx ON evt_erc8004 (agent_id);
CREATE INDEX IF NOT EXISTS evt_erc8004_kind_idx ON evt_erc8004 (event_kind);
