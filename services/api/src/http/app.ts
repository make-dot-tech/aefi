import { Hono } from "hono";
import * as caps from "../handlers/capabilities.js";
import { getDriver } from "../graph/queries.js";
import { loadX402Config, x402Gate } from "../x402/gate.js";

export function createApp() {
  const app = new Hono();
  const x402 = loadX402Config();

  app.get("/health", async (c) => {
    let neo4j = "unknown";
    try {
      await getDriver().verifyConnectivity();
      neo4j = "ok";
    } catch {
      neo4j = "unavailable";
    }
    return c.json({
      ok: true,
      service: "aefi-api",
      neo4j,
      x402: x402.enabled ? "enforced" : "off",
    });
  });

  app.use("/v1/*", async (c, next) => {
    const gate = await x402Gate(c.req.path, c.req.raw.headers, x402);
    if (!gate.allowed) {
      if (gate.paymentRequiredHeader) {
        c.header("PAYMENT-REQUIRED", gate.paymentRequiredHeader);
      }
      return c.json(gate.body, gate.status);
    }
    if (gate.paymentResponse) {
      c.header("PAYMENT-RESPONSE", gate.paymentResponse);
      c.header("x-aefi-auth", "x402");
    } else if (
      x402.apiKey &&
      c.req.header("x-aefi-api-key") === x402.apiKey
    ) {
      c.header("x-aefi-auth", "api-key");
    } else if (!x402.enabled) {
      c.header("x-aefi-auth", "dev-open");
    }
    await next();
  });

  app.post("/v1/payments/verify", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(await caps.verifyPayment(body));
  });

  app.get("/v1/transactions/:hash", async (c) => {
    return c.json(await caps.explainTransaction(c.req.param("hash")));
  });

  app.get("/v1/jobs/:job_id", async (c) => {
    return c.json(await caps.lookupJob(c.req.param("job_id")));
  });

  app.get("/v1/agents/:id/activity", async (c) => {
    return c.json(await caps.getAgentActivity(c.req.param("id")));
  });

  app.post("/v1/authority/check", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(caps.checkAuthority(body));
  });

  app.get("/v1/tasks/:task_execution_id", (c) => {
    return c.json(caps.traceTask(c.req.param("task_execution_id")));
  });

  app.post("/v1/providers/search", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    return c.json(caps.searchProviders(body));
  });

  return app;
}
