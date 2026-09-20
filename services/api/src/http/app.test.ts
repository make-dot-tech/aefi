import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createApp } from "./app.js";

const ENV_KEYS = [
  "AEFI_X402_ENABLED",
  "AEFI_API_KEY",
  "AEFI_X402_PAY_TO",
  "AEFI_X402_PRICE_USDC",
  "AEFI_X402_FACILITATOR_URL",
  "AEFI_RESOURCE_BASE_URL",
  "NEO4J_URI",
] as const;

const saved: Record<string, string | undefined> = {};

describe("HTTP discovery + x402", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
    }
    process.env.NEO4J_URI = "bolt://127.0.0.1:1";
    process.env.AEFI_API_KEY = "dev-local-key";
    process.env.AEFI_RESOURCE_BASE_URL = "https://api.aefi.io";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("publishes OpenAPI 3.1 at /openapi.json without payment", async () => {
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_X402_PAY_TO = "0x1111111111111111111111111111111111111111";
    const app = createApp();
    const res = await app.request("/openapi.json");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { openapi?: string };
    assert.equal(body.openapi, "3.1.0");
  });

  it("keeps scenarios free when the paywall is on", async () => {
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_X402_PAY_TO = "0x1111111111111111111111111111111111111111";
    const app = createApp();
    const res = await app.request("/v1/scenarios");
    assert.equal(res.status, 200);
  });

  it("allows the studio API key to bypass payment", async () => {
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_X402_PAY_TO = "0x1111111111111111111111111111111111111111";
    const app = createApp();
    const res = await app.request("/v1/authority/check", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aefi-api-key": "dev-local-key",
      },
      body: JSON.stringify({ action: "transfer" }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-aefi-auth"), "api-key");
  });

  it("returns 402 with multi-chain accepts[] and MPP challenge when unpaid", { timeout: 20_000 }, async () => {
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_X402_PAY_TO = "0x1111111111111111111111111111111111111111";
    process.env.AEFI_X402_FACILITATOR_URL = "https://gateway-api.circle.com";
    const app = createApp();
    const res = await app.request("/v1/payments/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx_hash: "0xabc" }),
    });
    assert.equal(res.status, 402);
    assert.ok(res.headers.get("PAYMENT-REQUIRED"));
    assert.match(res.headers.get("WWW-Authenticate") ?? "", /^Payment /);
    const body = (await res.json()) as {
      x402Version?: number;
      accepts?: Array<{ network?: string; amount?: string }>;
    };
    assert.equal(body.x402Version, 2);
    assert.ok(Array.isArray(body.accepts) && body.accepts.length > 1);
    const networks = new Set(body.accepts.map((a) => a.network));
    assert.ok(networks.size > 1, "expected more than one payment network");
    assert.ok(body.accepts.every((a) => a.amount === "10000"));
  });
});
