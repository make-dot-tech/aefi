import type { EventStore } from "../db/postgres.js";
import type { GraphStore } from "../db/neo4j.js";
import { runCorrelators } from "../correlators/index.js";
import type { Cursor } from "../types.js";

export interface ProjectOnceResult {
  advanced: boolean;
  cursor: Cursor;
  nodes: number;
  edges: number;
  facts: number;
  page: number;
  transfers: number;
  jobs: number;
  agents: number;
  memos: number;
}

export async function projectOnce(
  events: EventStore,
  graph: GraphStore,
  batchSize: number,
): Promise<ProjectOnceResult> {
  const cursor = await events.getCursor();
  const page = await events.fetchBasePage(cursor, batchSize);
  if (page.length === 0) {
    return {
      advanced: false,
      cursor,
      nodes: 0,
      edges: 0,
      facts: 0,
      page: 0,
      transfers: 0,
      jobs: 0,
      agents: 0,
      memos: 0,
    };
  }

  const ids = page.map((r) => r.id);
  const [transfers, memosInPage, jobs, agents] = await Promise.all([
    events.fetchTransfersByIds(ids),
    events.fetchMemosByIds(ids),
    events.fetchErc8183ByIds(ids),
    events.fetchErc8004ByIds(ids),
  ]);

  // Same-tx memos may sit at a lower log_index already projected; still join.
  const txHashes = [...new Set(transfers.map((t) => t.tx_hash))];
  const memosForTx = await events.fetchMemosForTxs(txHashes);
  const memosById = new Map<string, (typeof memosForTx)[0]>();
  for (const m of [...memosInPage, ...memosForTx]) memosById.set(m.id, m);
  const memos = [...memosById.values()];

  const batch = runCorrelators({ transfers, memos, jobs, agents });
  await graph.apply(batch);

  const last = page[page.length - 1]!;
  const next: Cursor = {
    lastBlock: Number(last.block_number),
    lastLogIndex: last.log_index,
  };
  await events.setCursor(next);

  return {
    advanced: true,
    cursor: next,
    nodes: batch.nodes.length,
    edges: batch.edges.length,
    facts: batch.facts.length,
    page: page.length,
    transfers: transfers.length,
    jobs: jobs.length,
    agents: agents.length,
    memos: memos.length,
  };
}
