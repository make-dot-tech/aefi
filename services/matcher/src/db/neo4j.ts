import neo4j, { type Driver } from "neo4j-driver";
import type { GraphEdge, GraphNode, ProjectionBatch } from "../types.js";

const CONSTRAINTS = [
  "CREATE CONSTRAINT wallet_id IF NOT EXISTS FOR (n:Wallet) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (n:Agent) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT job_id IF NOT EXISTS FOR (n:Job) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT payment_id IF NOT EXISTS FOR (n:Payment) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT transfer_id IF NOT EXISTS FOR (n:TransferEvent) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT memo_id IF NOT EXISTS FOR (n:MemoEvent) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT evidence_id IF NOT EXISTS FOR (n:Evidence) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT outcome_id IF NOT EXISTS FOR (n:Outcome) REQUIRE n.id IS UNIQUE",
];

/** Property indexes for hot read paths (tx lookup, chain filters). */
const INDEXES = [
  "CREATE INDEX payment_tx_hash IF NOT EXISTS FOR (n:Payment) ON (n.tx_hash)",
  "CREATE INDEX transfer_tx_hash IF NOT EXISTS FOR (n:TransferEvent) ON (n.tx_hash)",
  "CREATE INDEX memo_tx_hash IF NOT EXISTS FOR (n:MemoEvent) ON (n.tx_hash)",
  "CREATE INDEX job_tx_hash IF NOT EXISTS FOR (n:Job) ON (n.tx_hash)",
  "CREATE INDEX agent_chain_id IF NOT EXISTS FOR (n:Agent) ON (n.chain_id)",
  "CREATE INDEX job_chain_id IF NOT EXISTS FOR (n:Job) ON (n.chain_id)",
  "CREATE INDEX payment_chain_id IF NOT EXISTS FOR (n:Payment) ON (n.chain_id)",
];

const WRITE_CHUNK = 200;

export class GraphStore {
  readonly driver: Driver;

  constructor(uri: string, user: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  async verify(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async ensureSchema(): Promise<void> {
    const session = this.driver.session();
    try {
      for (const cypher of CONSTRAINTS) {
        await session.run(cypher);
      }
      for (const cypher of INDEXES) {
        await session.run(cypher);
      }
    } finally {
      await session.close();
    }
  }

  async apply(batch: ProjectionBatch): Promise<void> {
    if (batch.nodes.length === 0 && batch.edges.length === 0) return;
    const session = this.driver.session();
    try {
      await session.executeWrite(async (tx) => {
        const byLabel = new Map<string, GraphNode[]>();
        const idToLabel = new Map<string, string>();
        for (const node of batch.nodes) {
          const list = byLabel.get(node.label) ?? [];
          list.push(node);
          byLabel.set(node.label, list);
          idToLabel.set(node.id, node.label);
        }
        for (const [label, nodes] of byLabel) {
          for (const chunk of chunked(nodes, WRITE_CHUNK)) {
            await tx.run(
              `
              UNWIND $rows AS row
              MERGE (n:${label} {id: row.id})
              SET n += row.props
              `,
              {
                rows: chunk.map((n) => ({
                  id: n.id,
                  props: { id: n.id, ...(n.props ?? {}) },
                })),
              },
            );
          }
        }

        const byType = new Map<string, GraphEdge[]>();
        for (const edge of batch.edges) {
          const list = byType.get(edge.type) ?? [];
          list.push(edge);
          byType.set(edge.type, list);
        }
        for (const [type, edges] of byType) {
          for (const chunk of chunked(edges, WRITE_CHUNK)) {
            // Prefer labeled MATCH so uniqueness constraints are used.
            // Fall back to unlabeled MATCH when endpoint labels are unknown
            // (should be rare — nodes are written before edges in the same txn).
            const labeled: Array<{
              from: string;
              to: string;
              fromLabel: string;
              toLabel: string;
              props: Record<string, unknown>;
            }> = [];
            const unlabeled: Array<{
              from: string;
              to: string;
              props: Record<string, unknown>;
            }> = [];
            for (const e of chunk) {
              const fromLabel = idToLabel.get(e.from);
              const toLabel = idToLabel.get(e.to);
              if (fromLabel && toLabel) {
                labeled.push({
                  from: e.from,
                  to: e.to,
                  fromLabel,
                  toLabel,
                  props: e.props ?? {},
                });
              } else {
                unlabeled.push({
                  from: e.from,
                  to: e.to,
                  props: e.props ?? {},
                });
              }
            }

            // Group labeled edges by endpoint label pair for valid Cypher.
            const byPair = new Map<string, typeof labeled>();
            for (const row of labeled) {
              const key = `${row.fromLabel}->${row.toLabel}`;
              const list = byPair.get(key) ?? [];
              list.push(row);
              byPair.set(key, list);
            }
            for (const [, rows] of byPair) {
              const fromLabel = rows[0]!.fromLabel;
              const toLabel = rows[0]!.toLabel;
              await tx.run(
                `
                UNWIND $rows AS row
                MATCH (a:${fromLabel} {id: row.from}), (b:${toLabel} {id: row.to})
                MERGE (a)-[r:${type}]->(b)
                SET r += row.props
                `,
                {
                  rows: rows.map((r) => ({
                    from: r.from,
                    to: r.to,
                    props: r.props,
                  })),
                },
              );
            }

            if (unlabeled.length > 0) {
              await tx.run(
                `
                UNWIND $rows AS row
                MATCH (a {id: row.from}), (b {id: row.to})
                MERGE (a)-[r:${type}]->(b)
                SET r += row.props
                `,
                { rows: unlabeled },
              );
            }
          }
        }
      });
    } finally {
      await session.close();
    }
  }
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
