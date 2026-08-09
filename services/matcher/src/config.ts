export interface MatcherConfig {
  databaseUrl: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
  chainId: string;
  batchSize: number;
  pollMs: number;
  once: boolean;
  /** Cloud Run health listen port (optional). */
  healthPort: number | null;
}

export function loadConfig(argv = process.argv.slice(2)): MatcherConfig {
  const once = argv.includes("--once");
  const healthRaw = process.env.PORT ?? process.env.MATCHER_HEALTH_PORT;
  return {
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgres://aefi:aefi@localhost:5432/aefi?sslmode=disable",
    neo4jUri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    neo4jUser: process.env.NEO4J_USER ?? process.env.NEO4J_USERNAME ?? "neo4j",
    neo4jPassword: process.env.NEO4J_PASSWORD ?? "aefi-dev-password",
    chainId: String(process.env.ARC_CHAIN_ID ?? "5042002"),
    batchSize: Number(process.env.MATCHER_BATCH_SIZE ?? 200),
    pollMs: Number(process.env.MATCHER_POLL_MS ?? 2000),
    once,
    healthPort: healthRaw ? Number(healthRaw) : null,
  };
}
