import { serve } from "@hono/node-server";
import { createApp } from "./http/app.js";
import { startMcpStdio } from "./mcp/server.js";

const mode = process.env.AEFI_MODE ?? "http";

async function main() {
  if (mode === "mcp") {
    await startMcpStdio();
    return;
  }

  const port = Number(process.env.AEFI_HTTP_PORT ?? 8787);
  const app = createApp();
  serve({ fetch: app.fetch, port }, () => {
    console.log(`aefi api listening on :${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
