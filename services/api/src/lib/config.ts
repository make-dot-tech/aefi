export function loadNeo4jConfig() {
  return {
    uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? process.env.NEO4J_USERNAME ?? "neo4j",
    password: process.env.NEO4J_PASSWORD ?? "aefi-dev-password",
  };
}

/** Arc chain id for graph reads (shared Aura holds multiple networks). */
export function loadChainId(): string {
  return String(process.env.ARC_CHAIN_ID ?? process.env.AEFI_CHAIN_ID ?? "5042002");
}
