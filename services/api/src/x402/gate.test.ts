import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { loadX402Config, isUsablePayTo } from "./config.js";
import { paymentWwwAuthenticate } from "./mpp.js";

const ENV_KEYS = [
  "AEFI_X402_ENABLED",
  "AEFI_API_KEY",
  "AEFI_X402_PAY_TO",
  "AEFI_X402_PRICE_USDC",
  "AEFI_X402_PRICE_ATOMIC",
  "AEFI_X402_FACILITATOR_URL",
  "AEFI_X402_NETWORKS",
  "AEFI_RESOURCE_BASE_URL",
] as const;

const saved: Record<string, string | undefined> = {};

describe("x402 config", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("stays off when payTo is the burn placeholder", () => {
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_X402_PAY_TO = "0x000000000000000000000000000000000000aef1";
    const cfg = loadX402Config();
    assert.equal(cfg.enabled, false);
    assert.equal(isUsablePayTo(cfg.payTo.toLowerCase()), false);
  });

  it("enforces when a real payTo is set", () => {
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_X402_PAY_TO = "0x1111111111111111111111111111111111111111";
    const cfg = loadX402Config();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.priceUsdc, "0.01");
  });

  it("builds an MPP Payment challenge", () => {
    process.env.AEFI_RESOURCE_BASE_URL = "https://api.aefi.io";
    const cfg = loadX402Config();
    const header = paymentWwwAuthenticate(cfg);
    assert.match(header, /^Payment /);
    assert.match(header, /currency="USDC"/);
    assert.match(header, /amount="0.010000"/);
  });
});
