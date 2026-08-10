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

  it("prefers thick perfect history over one-job perfect providers", () => {
    const oneJob = scoreProvider({
      verified_jobs: 1,
      completion_rate: 1,
      payment_linked_jobs: 1,
      feedback_events: 0,
      confidence: "low",
    });
    const fiveJobs = scoreProvider({
      verified_jobs: 5,
      completion_rate: 1,
      payment_linked_jobs: 5,
      feedback_events: 0,
      confidence: "medium",
    });
    const tenJobs = scoreProvider({
      verified_jobs: 10,
      completion_rate: 0.8,
      payment_linked_jobs: 10,
      feedback_events: 0,
      confidence: "medium",
    });
    const sixJobsHalf = scoreProvider({
      verified_jobs: 6,
      completion_rate: 0.5,
      payment_linked_jobs: 6,
      feedback_events: 0,
      confidence: "medium",
    });

    assert.ok(oneJob.ranking_explanation.includes("thin_history_completion_discounted"));
    assert.ok(Math.abs(oneJob.score - 50) < 0.1);
    assert.ok(fiveJobs.score > tenJobs.score);
    assert.ok(tenJobs.score > sixJobsHalf.score);
    assert.ok(sixJobsHalf.score > oneJob.score);
  });

  it("applies light recency when tip and last_block are present", () => {
    const base = scoreProvider({
      verified_jobs: 5,
      completion_rate: 1,
      payment_linked_jobs: 5,
      feedback_events: 0,
      confidence: "medium",
      last_block: 1000,
      tip_block: 2000,
    });
    const stale = scoreProvider({
      verified_jobs: 5,
      completion_rate: 1,
      payment_linked_jobs: 5,
      feedback_events: 0,
      confidence: "medium",
      last_block: 1000,
      tip_block: 200_000,
    });
    assert.ok(base.score > stale.score);
    assert.ok(base.ranking_explanation.includes("recent_onchain_activity"));
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
