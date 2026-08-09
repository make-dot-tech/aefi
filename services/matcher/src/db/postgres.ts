import pg from "pg";
import type {
  Cursor,
  Erc8004Row,
  Erc8183Row,
  MemoRow,
  TransferRow,
} from "../types.js";

const { Pool } = pg;

export interface BaseEventRef {
  id: string;
  chain_id: string;
  block_number: string;
  tx_hash: string;
  log_index: number;
  event_name: string;
  address: string;
}

export class EventStore {
  readonly pool: pg.Pool;
  readonly chainId: string;
  readonly cursorId: string;

  constructor(databaseUrl: string, chainId: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.chainId = chainId;
    this.cursorId = `neo4j:${chainId}`;
  }

  async close() {
    await this.pool.end();
  }

  async ensureCursor(): Promise<void> {
    await this.pool.query(
      `INSERT INTO matcher_cursor (id, last_block, last_log_index)
       VALUES ($1, 0, 0)
       ON CONFLICT (id) DO NOTHING`,
      [this.cursorId],
    );
  }

  async getCursor(): Promise<Cursor> {
    await this.ensureCursor();
    const { rows } = await this.pool.query<{
      last_block: string;
      last_log_index: number;
    }>(`SELECT last_block, last_log_index FROM matcher_cursor WHERE id = $1`, [
      this.cursorId,
    ]);
    if (!rows[0]) return { lastBlock: 0, lastLogIndex: 0 };
    return {
      lastBlock: Number(rows[0].last_block),
      lastLogIndex: rows[0].last_log_index,
    };
  }

  async setCursor(cursor: Cursor): Promise<void> {
    await this.pool.query(
      `INSERT INTO matcher_cursor (id, last_block, last_log_index, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET
         last_block = EXCLUDED.last_block,
         last_log_index = EXCLUDED.last_log_index,
         updated_at = now()`,
      [this.cursorId, cursor.lastBlock, cursor.lastLogIndex],
    );
  }

  /** Unified watermark stream for one chain — never skip events across families. */
  async fetchBasePage(cursor: Cursor, limit: number): Promise<BaseEventRef[]> {
    const { rows } = await this.pool.query(
      `SELECT id, chain_id::text, block_number::text, tx_hash, log_index, event_name, address
       FROM evt_base
       WHERE chain_id = $1
         AND (
           (block_number > $2)
           OR (block_number = $2 AND log_index > $3)
         )
       ORDER BY block_number, log_index
       LIMIT $4`,
      [this.chainId, cursor.lastBlock, cursor.lastLogIndex, limit],
    );
    return rows as BaseEventRef[];
  }

  async fetchTransfersByIds(ids: string[]): Promise<TransferRow[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT b.id, b.chain_id::text, b.block_number::text, b.tx_hash, b.log_index,
              b.address, b.event_name, b.decoded,
              t.from_addr, t.to_addr, t.value::text, t.decimals, t.emitter_role
       FROM evt_transfer t
       JOIN evt_base b ON b.id = t.id
       WHERE t.id = ANY($1::text[])`,
      [ids],
    );
    return rows.map(normalizeDecoded) as TransferRow[];
  }

  async fetchMemosByIds(ids: string[]): Promise<MemoRow[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT b.id, b.chain_id::text, b.block_number::text, b.tx_hash, b.log_index,
              b.address, b.event_name, b.decoded,
              m.sender, m.memo_id, m.payload, m.call_data_hash
       FROM evt_memo m
       JOIN evt_base b ON b.id = m.id
       WHERE m.id = ANY($1::text[])`,
      [ids],
    );
    return rows.map(normalizeDecoded) as MemoRow[];
  }

  async fetchMemosForTxs(txHashes: string[]): Promise<MemoRow[]> {
    if (txHashes.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT b.id, b.chain_id::text, b.block_number::text, b.tx_hash, b.log_index,
              b.address, b.event_name, b.decoded,
              m.sender, m.memo_id, m.payload, m.call_data_hash
       FROM evt_memo m
       JOIN evt_base b ON b.id = m.id
       WHERE b.tx_hash = ANY($1::text[])`,
      [txHashes],
    );
    return rows.map(normalizeDecoded) as MemoRow[];
  }

  async fetchErc8183ByIds(ids: string[]): Promise<Erc8183Row[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT b.id, b.chain_id::text, b.block_number::text, b.tx_hash, b.log_index,
              b.address, b.event_name, b.decoded,
              e.job_id, e.event_kind, e.payload
       FROM evt_erc8183 e
       JOIN evt_base b ON b.id = e.id
       WHERE e.id = ANY($1::text[])`,
      [ids],
    );
    return rows.map(normalizeDecoded) as Erc8183Row[];
  }

  async fetchErc8004ByIds(ids: string[]): Promise<Erc8004Row[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query(
      `SELECT b.id, b.chain_id::text, b.block_number::text, b.tx_hash, b.log_index,
              b.address, b.event_name, b.decoded,
              e.registry, e.event_kind, e.agent_id, e.payload
       FROM evt_erc8004 e
       JOIN evt_base b ON b.id = e.id
       WHERE e.id = ANY($1::text[])`,
      [ids],
    );
    return rows.map(normalizeDecoded) as Erc8004Row[];
  }
}

function tryParseJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return value;
  // Hex / opaque chain bytes (memo payload) are not JSON.
  if (s.startsWith("0x") || s.startsWith("0X")) return value;
  const head = s[0];
  if (head !== "{" && head !== "[" && head !== '"' && head !== "t" && head !== "f" && head !== "n" && !(head >= "0" && head <= "9") && head !== "-") {
    return value;
  }
  try {
    return JSON.parse(s);
  } catch {
    return value;
  }
}

function normalizeDecoded<T extends { decoded: unknown; payload?: unknown }>(
  row: T,
): T {
  const decoded = tryParseJson(row.decoded) ?? {};
  const payload =
    row.payload === undefined ? undefined : tryParseJson(row.payload);
  return { ...row, decoded, ...(payload !== undefined ? { payload } : {}) };
}
