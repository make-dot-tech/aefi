import { Hono } from "hono";
import { cors } from "hono/cors";
import { DEMO_EXAMPLES } from "../demo/examples.js";
import { DEMO_SCENARIOS, seedDemoProviders } from "../demo/seed.js";
import * as caps from "../handlers/capabilities.js";
import { getDriver } from "../graph/queries.js";
import { loadX402Config, x402Gate } from "../x402/gate.js";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://demo.aefi.io",
  "https://hackathon.aefi.io",
  "https://aefi.io",
  "https://www.aefi.io",
];

function corsOrigins(): string[] {
  const extra = (process.env.AEFI_CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...extra])];
}

function demoSeedAllowed(
  headers: Headers,
  apiKey: string | null | undefined,
): boolean {
  if (process.env.AEFI_ALLOW_DEMO_SEED === "true") return true;
  if (apiKey && headers.get("x-aefi-api-key") === apiKey) return true;
  return process.env.NODE_ENV !== "production";
}

export function createApp() {
  const app = new Hono();
  const x402 = loadX402Config();
  const origins = corsOrigins();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return origins[0]!;
        if (origins.includes(origin)) return origin;
        if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
          return origin;
        }
        return null;
      },
      allowHeaders: [
        "Content-Type",
        "x-aefi-api-key",
        "PAYMENT-SIGNATURE",
        "PAYMENT-REQUIRED",
      ],
      exposeHeaders: [
        "PAYMENT-REQUIRED",
        "PAYMENT-RESPONSE",
        "x-aefi-auth",
      ],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

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
    const path = c.req.path;
    if (
      path === "/v1/demo/examples" ||
      path === "/v1/demo/scenarios"
    ) {
      await next();
      return;
    }
    const gate = await x402Gate(path, c.req.raw.headers, x402);
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

  app.get("/v1/demo/examples", (c) => {
    return c.json({
      examples: DEMO_EXAMPLES,
      note: "Fixture hashes are for studio demos; live Neo4j may not contain them.",
    });
  });

  app.get("/v1/demo/scenarios", (c) => {
    return c.json({ scenarios: DEMO_SCENARIOS });
  });

  app.post("/v1/demo/seed", async (c) => {
    if (!demoSeedAllowed(c.req.raw.headers, x402.apiKey)) {
      return c.json({ error: "demo seed disabled" }, 403);
    }
    try {
      const result = await seedDemoProviders();
      return c.json({ ok: true, ...result });
    } catch (err) {
      return c.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "seed failed",
        },
        503,
      );
    }
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
    return c.json(await caps.searchProviders(body));
  });

  app.get("/v1/providers/:id", async (c) => {
    return c.json(await caps.getProvider(c.req.param("id")));
  });

  return app;
}
