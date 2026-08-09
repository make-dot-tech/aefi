import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { listCorrelators } from "./correlators/index.js";
import { EventStore } from "./db/postgres.js";
import { GraphStore } from "./db/neo4j.js";
import { projectOnce } from "./project/run.js";

async function main() {
  const cfg = loadConfig();
  console.log("aefi matcher", {
    chainId: cfg.chainId,
    correlators: listCorrelators(),
    once: cfg.once,
    batchSize: cfg.batchSize,
  });

  if (cfg.healthPort != null && Number.isFinite(cfg.healthPort)) {
    createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "matcher", chainId: cfg.chainId }));
    }).listen(cfg.healthPort, "0.0.0.0", () => {
      console.log(`matcher health on 0.0.0.0:${cfg.healthPort}`);
    });
  }

  const events = new EventStore(cfg.databaseUrl, cfg.chainId);
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
      try {
        const result = await projectOnce(events, graph, cfg.batchSize);
        if (result.advanced) {
          console.log("projected", result);
        }
      } catch (err) {
        console.error("projectOnce failed; will retry", err);
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
