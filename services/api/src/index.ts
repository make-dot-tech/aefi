import { serve } from "@hono/node-server";
import { ensureGraphIndexes } from "./graph/queries.js";
import { createApp } from "./http/app.js";
import { startMcpStdio } from "./mcp/server.js";

const mode = process.env.AEFI_MODE ?? "http";

async function main() {
  if (mode === "mcp") {
    await startMcpStdio();
    return;
  }

  // Cloud Run sets PORT; local default remains AEFI_HTTP_PORT / 8787.
  const port = Number(process.env.PORT ?? process.env.AEFI_HTTP_PORT ?? 8787);
  const app = createApp();
  // Best-effort: create tx_hash / chain indexes without blocking listen.
  void ensureGraphIndexes().catch((err) => {
    console.warn("ensureGraphIndexes failed", err);
  });
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`aefi api listening on 0.0.0.0:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
