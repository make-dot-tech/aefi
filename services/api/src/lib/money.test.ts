import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAssetAmount, resolveTokenDecimals } from "./money.js";

describe("money", () => {
  it("formats ERC-20 USDC (6 decimals)", () => {
    assert.equal(
      formatAssetAmount("1000000", { decimals: 6, asset: "USDC" }),
      "1 USDC",
    );
    assert.equal(
      formatAssetAmount("2500000", { decimals: 6, asset: "USDC" }),
      "2.5 USDC",
    );
  });

  it("formats native system USDC (18 decimals)", () => {
    assert.equal(
      formatAssetAmount("1000000000000000000", {
        decimals: 18,
        asset: "USDC",
      }),
      "1 USDC",
    );
  });

  it("infers 18 vs 6 for USDC when decimals omitted", () => {
    assert.equal(
      resolveTokenDecimals({
        amount: "1000000000000000000",
        asset: "USDC",
      }),
      18,
    );
    assert.equal(
      resolveTokenDecimals({ amount: "1000000", asset: "USDC" }),
      6,
    );
  });
});
