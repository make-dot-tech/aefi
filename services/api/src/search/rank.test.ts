import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capabilityText } from "./embeddings.js";
import {
  fuseScores,
  pageProviders,
  shouldHardRestrictSemantic,
  sortProviders,
} from "./rank.js";

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

describe("shouldHardRestrictSemantic", () => {
  it("allows hard-restrict for capability discovery with no floors", () => {
    assert.equal(shouldHardRestrictSemantic({}), true);
    assert.equal(
      shouldHardRestrictSemantic({
        minimum_verified_jobs: 0,
        minimum_completion_rate: 0,
        minimum_confidence: "unverified",
      }),
      true,
    );
  });

  it("disables hard-restrict when job or rate floors are set", () => {
    assert.equal(
      shouldHardRestrictSemantic({ minimum_verified_jobs: 1 }),
      false,
    );
    assert.equal(
      shouldHardRestrictSemantic({ minimum_completion_rate: 0.5 }),
      false,
    );
    assert.equal(
      shouldHardRestrictSemantic({ minimum_confidence: "medium" }),
      false,
    );
  });
});

describe("sortProviders + pageProviders", () => {
  const rows = [
    {
      provider_id: "agent:b",
      score: 100,
      performance: { verified_jobs: 1, completion_rate: 1 },
      identity: { last_block: 10, last_tx: "0x1" },
    },
    {
      provider_id: "agent:a",
      score: 100,
      performance: { verified_jobs: 5, completion_rate: 0.5 },
      identity: { last_block: 20, last_tx: "0x2" },
    },
    {
      provider_id: "agent:c",
      score: 80,
      performance: { verified_jobs: 2, completion_rate: 1 },
      identity: { last_block: null, last_tx: null },
    },
  ];

  it("tie-breaks score sort by provider_id", () => {
    const sorted = sortProviders(rows, "score", "desc");
    assert.equal(sorted[0]!.provider_id, "agent:a");
    assert.equal(sorted[1]!.provider_id, "agent:b");
    assert.equal(sorted[2]!.provider_id, "agent:c");
  });

  it("sorts by verified_jobs descending", () => {
    const sorted = sortProviders(rows, "verified_jobs", "desc");
    assert.equal(sorted[0]!.provider_id, "agent:a");
    assert.equal(sorted[1]!.provider_id, "agent:c");
    assert.equal(sorted[2]!.provider_id, "agent:b");
  });

  it("puts null recent activity last", () => {
    const sorted = sortProviders(rows, "recent", "desc");
    assert.equal(sorted[0]!.provider_id, "agent:a");
    assert.equal(sorted[1]!.provider_id, "agent:b");
    assert.equal(sorted[2]!.provider_id, "agent:c");
  });

  it("pages with offset and has_more", () => {
    const sorted = sortProviders(rows, "score", "desc");
    const page = pageProviders(sorted, 1, 1);
    assert.equal(page.total_matched, 3);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]!.provider_id, "agent:b");
    assert.equal(page.has_more, true);
  });
});
