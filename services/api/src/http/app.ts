import { Hono } from "hono";
import { cors } from "hono/cors";
import { SEARCH_SCENARIOS } from "../scenarios.js";
import * as caps from "../handlers/capabilities.js";
import { getDriver } from "../graph/queries.js";
import { loadX402Config, createGatewayHonoMiddleware } from "../x402/gate.js";
import { getOpenApiDocument } from "./openapi.js";

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
        "Payment-Signature",
        "PAYMENT-REQUIRED",
      ],
      exposeHeaders: [
        "PAYMENT-REQUIRED",
        "PAYMENT-RESPONSE",
        "WWW-Authenticate",
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

  app.get("/openapi.json", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(getOpenApiDocument());
  });

  if (x402.enabled) {
    app.use("/v1/*", createGatewayHonoMiddleware(x402));
  } else {
    app.use("/v1/*", async (c, next) => {
      c.header("x-aefi-auth", "dev-open");
      await next();
    });
  }

  app.get("/v1/scenarios", (c) => {
    return c.json({ scenarios: SEARCH_SCENARIOS });
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
