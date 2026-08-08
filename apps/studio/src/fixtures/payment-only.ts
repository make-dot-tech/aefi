import type { AefiEnvelope, ExplainResult, VerifyResult } from "../lib/types";

export const paymentOnlyExplain: AefiEnvelope<ExplainResult> = {
  summary:
    "Transaction 0xdemo…001: 1 payment(s), 1 transfer(s), 0 memo(s).",
  result: {
    tx_hash:
      "0xdemo000000000000000000000000000000000000000000000000000000000001",
    steps: [
      {
        step: "settlement",
        transfer_id: "xfer:demo:1",
        from: "0xaaa1111111111111111111111111111111111111",
        to: "0xbbb2222222222222222222222222222222222222",
        value: "2500000",
      },
      {
        step: "payment",
        payment_id: "pay:demo:1",
        from: "0xaaa1111111111111111111111111111111111111",
        to: "0xbbb2222222222222222222222222222222222222",
        amount: "2500000",
      },
    ],
  },
  confidence: "medium",
  confidence_reasons: [
    "payment_only_observed",
    "authorization_evidence_missing",
  ],
  confidence_model_version: "0.1.0",
  evidence: [
    {
      evidence_id: "ev:demo:xfer:1",
      type: "transfer",
      source: "arc:5042002",
      reference:
        "0xdemo000000000000000000000000000000000000000000000000000000000001",
      supports: ["pay:demo:1"],
    },
  ],
  coverage: {
    status: "minimal",
    known_gaps: [
      "authorization_evidence_missing",
      "job_link_missing",
      "memo_missing",
    ],
  },
  graph_refs: { node_ids: ["pay:demo:1", "xfer:demo:1"] },
};

export const paymentOnlyVerify: AefiEnvelope<VerifyResult> = {
  summary:
    "Settled 2.50 USDC from 0xaaa1…1111 to 0xbbb2…2222 (payment-only path).",
  result: {
    verified: true,
    payments: [
      {
        payment_id: "pay:demo:1",
        tx_hash:
          "0xdemo000000000000000000000000000000000000000000000000000000000001",
        amount: "2500000",
        asset: "USDC",
        from: "0xaaa1111111111111111111111111111111111111",
        to: "0xbbb2222222222222222222222222222222222222",
        transfer_id: "xfer:demo:1",
        memo_ids: [],
        job_ids: [],
      },
    ],
  },
  confidence: "medium",
  confidence_reasons: [
    "payment_only_observed",
    "authorization_evidence_missing",
  ],
  confidence_model_version: "0.1.0",
  evidence: paymentOnlyExplain.evidence,
  coverage: paymentOnlyExplain.coverage,
  graph_refs: paymentOnlyExplain.graph_refs,
};
