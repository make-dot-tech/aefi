import neo4j, { type Driver, type Session } from "neo4j-driver";
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
    } finally {
      await session.close();
    }
  }

  async apply(batch: ProjectionBatch): Promise<void> {
    if (batch.nodes.length === 0 && batch.edges.length === 0) return;
    const session = this.driver.session();
    try {
      await session.executeWrite(async (tx) => {
        for (const node of batch.nodes) {
          await mergeNode(tx, node);
        }
        for (const edge of batch.edges) {
          await mergeEdge(tx, edge);
        }
      });
    } finally {
      await session.close();
    }
  }
}

async function mergeNode(
  tx: { run: Session["run"] },
  node: GraphNode,
): Promise<void> {
  const props = { id: node.id, ...(node.props ?? {}) };
  // Label is controlled by our correlators, not user input.
  const cypher = `MERGE (n:${node.label} {id: $id}) SET n += $props`;
  await tx.run(cypher, { id: node.id, props });
}

async function mergeEdge(
  tx: { run: Session["run"] },
  edge: GraphEdge,
): Promise<void> {
  const props = edge.props ?? {};
  const cypher = `
    MATCH (a {id: $from}), (b {id: $to})
    MERGE (a)-[r:${edge.type}]->(b)
    SET r += $props
  `;
  await tx.run(cypher, { from: edge.from, to: edge.to, props });
}
