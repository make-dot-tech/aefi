import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capabilityText } from "./embeddings.js";
import { fuseScores } from "./rank.js";

describe("capabilityText", () => {
  it("joins unique capability fields", () => {
    const t = capabilityText({
      display_name: "NovaFeed",
      capabilities: ["market-data", "price-oracle"],
      blurb: "High-reliability market data",
    });
    assert.match(t, /NovaFeed/);
    assert.match(t, /market-data/);
    assert.match(t, /price-oracle/);
  });
});

describe("fuseScores", () => {
  it("weights graph score higher than semantic by default", () => {
    const fused = fuseScores({
      semanticSimilarity: 0.9,
      graphScore: 100,
      maxGraphScore: 100,
    });
    // α=0.35 * 0.9*100 + β=0.65 * 100 = 31.5 + 65 = 96.5
    assert.ok(fused.fused > 90);
    assert.ok(fused.reasons.includes("capability_semantic_match"));
  });
});
