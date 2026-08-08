import { loadConfig } from "./config.js";
import { listCorrelators } from "./correlators/index.js";
import { EventStore } from "./db/postgres.js";
import { GraphStore } from "./db/neo4j.js";
import { projectOnce } from "./project/run.js";

async function main() {
  const cfg = loadConfig();
  console.log("aefi matcher", {
    correlators: listCorrelators(),
    once: cfg.once,
    batchSize: cfg.batchSize,
  });

  const events = new EventStore(cfg.databaseUrl);
  const graph = new GraphStore(cfg.neo4jUri, cfg.neo4jUser, cfg.neo4jPassword);

  try {
    await graph.verify();
    await graph.ensureSchema();

    if (cfg.once) {
      const result = await projectOnce(events, graph, cfg.batchSize);
      console.log("projected once", result);
      return;
    }

    console.log("polling for new events…");
    for (;;) {
      const result = await projectOnce(events, graph, cfg.batchSize);
      if (result.advanced) {
        console.log("projected", result);
      }
      await sleep(cfg.pollMs);
    }
  } finally {
    await events.close();
    await graph.close();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
