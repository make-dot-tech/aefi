import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveConfidence, scoreProvider } from "../graph/providers.js";

describe("provider performance scoring", () => {
  it("ranks high-completion dense evidence above noisy peers", () => {
    const elite = scoreProvider({
      verified_jobs: 48,
      completion_rate: 0.979,
      payment_linked_jobs: 44,
      feedback_events: 18,
      confidence: "high",
    });
    const noisy = scoreProvider({
      verified_jobs: 22,
      completion_rate: 0.68,
      payment_linked_jobs: 8,
      feedback_events: 2,
      confidence: "low",
    });
    assert.ok(elite.score > noisy.score);
    assert.ok(elite.ranking_explanation.includes("completion_rate_above_threshold"));
  });

  it("derives high confidence from dense settlement evidence", () => {
    const c = deriveConfidence({
      verified_jobs: 48,
      completed_jobs: 47,
      payment_linked_jobs: 44,
      feedback_events: 18,
    });
    assert.equal(c.confidence, "high");
    assert.ok(c.evidence_distribution.high > 0);
  });
});
