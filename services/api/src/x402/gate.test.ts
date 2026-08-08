import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { b64json } from "./codec.js";
import { loadX402Config } from "./config.js";
import { x402Gate } from "./gate.js";
import { resetNoncesForTests } from "./nonce.js";

function headers(init: Record<string, string> = {}) {
  return new Headers(init);
}

function validSig(payTo: string, value: string, nonce: string) {
  return b64json({
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:5042002",
      maxAmountRequired: value,
      resource: "http://localhost:8787/v1/payments/verify",
      description: "test",
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: 60,
      asset: "0x3600000000000000000000000000000000000000",
      extra: {},
    },
    payload: {
      signature: "0x" + "ab".repeat(65),
      authorization: {
        from: "0x1111111111111111111111111111111111111111",
        to: payTo,
        value,
        validAfter: "0",
        validBefore: "9999999999",
        nonce,
      },
    },
  });
}

describe("x402Gate", () => {
  beforeEach(() => {
    resetNoncesForTests();
    process.env.AEFI_X402_ENABLED = "true";
    process.env.AEFI_API_KEY = "dev-local-key";
    process.env.AEFI_X402_PAY_TO = "0x000000000000000000000000000000000000aef1";
    process.env.AEFI_X402_PRICE_ATOMIC = "10000";
    process.env.AEFI_X402_DEV_ACCEPT = "true";
    delete process.env.AEFI_X402_FACILITATOR_URL;
  });

  it("challenges without payment signature", async () => {
    const cfg = loadX402Config();
    const gate = await x402Gate("/v1/payments/verify", headers(), cfg);
    assert.equal(gate.allowed, false);
    if (!gate.allowed) {
      assert.equal(gate.status, 402);
      assert.ok(gate.paymentRequiredHeader);
    }
  });

  it("allows api key bypass", async () => {
    const cfg = loadX402Config();
    const gate = await x402Gate(
      "/v1/payments/verify",
      headers({ "x-aefi-api-key": "dev-local-key" }),
      cfg,
    );
    assert.equal(gate.allowed, true);
  });

  it("accepts valid payment signature in dev mode", async () => {
    const cfg = loadX402Config();
    const sig = validSig(cfg.payTo, "10000", "0x" + "11".repeat(32));
    const gate = await x402Gate(
      "/v1/payments/verify",
      headers({ "PAYMENT-SIGNATURE": sig }),
      cfg,
    );
    assert.equal(gate.allowed, true);
    if (gate.allowed) {
      assert.ok(gate.paymentResponse);
      assert.equal(gate.settlement?.mode, "dev");
    }
  });

  it("rejects nonce replay", async () => {
    const cfg = loadX402Config();
    const nonce = "0x" + "22".repeat(32);
    const sig = validSig(cfg.payTo, "10000", nonce);
    const first = await x402Gate(
      "/v1/payments/verify",
      headers({ "PAYMENT-SIGNATURE": sig }),
      cfg,
    );
    assert.equal(first.allowed, true);
    const second = await x402Gate(
      "/v1/payments/verify",
      headers({ "PAYMENT-SIGNATURE": sig }),
      cfg,
    );
    assert.equal(second.allowed, false);
  });
});
