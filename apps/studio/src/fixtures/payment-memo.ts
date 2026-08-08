import type { AefiEnvelope, ExplainResult, VerifyResult } from "../lib/types";

export const paymentMemoExplain: AefiEnvelope<ExplainResult> = {
  summary:
    "Transaction 0xdemo…002: 1 payment(s), 1 transfer(s), 1 memo(s).",
  result: {
    tx_hash:
      "0xdemo000000000000000000000000000000000000000000000000000000000002",
    steps: [
      {
        step: "settlement",
        transfer_id: "xfer:demo:2",
        from: "0xccc3333333333333333333333333333333333333",
        to: "0xddd4444444444444444444444444444444444444",
        value: "10000000",
      },
      {
        step: "memo",
        memo_id: "memo:demo:2",
        sender: "0xccc3333333333333333333333333333333333333",
      },
      {
        step: "payment",
        payment_id: "pay:demo:2",
        from: "0xccc3333333333333333333333333333333333333",
        to: "0xddd4444444444444444444444444444444444444",
        amount: "10000000",
      },
    ],
  },
  confidence: "medium",
  confidence_reasons: ["memo_linked", "authorization_evidence_missing"],
  confidence_model_version: "0.1.0",
  evidence: [
    {
      evidence_id: "ev:demo:xfer:2",
      type: "transfer",
      source: "arc:5042002",
      reference:
        "0xdemo000000000000000000000000000000000000000000000000000000000002",
      supports: ["pay:demo:2"],
    },
    {
      evidence_id: "ev:demo:memo:2",
      type: "memo",
      source: "arc:5042002",
      reference: "memo:demo:2",
      supports: ["pay:demo:2"],
    },
  ],
  coverage: {
    status: "partial",
    known_gaps: ["authorization_evidence_missing", "job_link_missing"],
  },
  graph_refs: { node_ids: ["pay:demo:2", "xfer:demo:2"] },
};

export const paymentMemoVerify: AefiEnvelope<VerifyResult> = {
  summary: "Settled 10.00 USDC with same-tx memo annotation.",
  result: {
    verified: true,
    payments: [
      {
        payment_id: "pay:demo:2",
        tx_hash:
          "0xdemo000000000000000000000000000000000000000000000000000000000002",
        amount: "10000000",
        asset: "USDC",
        from: "0xccc3333333333333333333333333333333333333",
        to: "0xddd4444444444444444444444444444444444444",
        transfer_id: "xfer:demo:2",
        memo_ids: ["memo:demo:2"],
        job_ids: [],
      },
    ],
  },
  confidence: "medium",
  confidence_reasons: ["memo_linked", "authorization_evidence_missing"],
  confidence_model_version: "0.1.0",
  evidence: paymentMemoExplain.evidence,
  coverage: paymentMemoExplain.coverage,
  graph_refs: paymentMemoExplain.graph_refs,
};
