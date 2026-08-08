import type { AefiEnvelope, ExplainResult, VerifyResult } from "../lib/types";

export const paymentJobExplain: AefiEnvelope<ExplainResult> = {
  summary:
    "Transaction 0xdemo…003: 1 payment(s), 1 transfer(s), 0 memo(s).",
  result: {
    tx_hash:
      "0xdemo000000000000000000000000000000000000000000000000000000000003",
    steps: [
      {
        step: "settlement",
        transfer_id: "xfer:demo:3",
        from: "0xeee5555555555555555555555555555555555555",
        to: "0xfff6666666666666666666666666666666666666",
        value: "42000000",
      },
      {
        step: "payment",
        payment_id: "pay:demo:3",
        from: "0xeee5555555555555555555555555555555555555",
        to: "0xfff6666666666666666666666666666666666666",
        amount: "42000000",
      },
      {
        step: "job",
        job_id: "8183",
      },
    ],
  },
  confidence: "high",
  confidence_reasons: ["job_linked", "settlement_observed"],
  confidence_model_version: "0.1.0",
  evidence: [
    {
      evidence_id: "ev:demo:xfer:3",
      type: "transfer",
      source: "arc:5042002",
      reference:
        "0xdemo000000000000000000000000000000000000000000000000000000000003",
      supports: ["pay:demo:3"],
    },
    {
      evidence_id: "ev:demo:job:3",
      type: "erc8183_job",
      source: "arc:5042002",
      reference: "job:erc8183:5042002:8183",
      supports: ["pay:demo:3"],
    },
  ],
  coverage: {
    status: "partial",
    known_gaps: ["authorization_evidence_missing"],
  },
  graph_refs: { node_ids: ["pay:demo:3", "xfer:demo:3"] },
};

export const paymentJobVerify: AefiEnvelope<VerifyResult> = {
  summary: "Settled 42.00 USDC linked to ERC-8183 job 8183.",
  result: {
    verified: true,
    payments: [
      {
        payment_id: "pay:demo:3",
        tx_hash:
          "0xdemo000000000000000000000000000000000000000000000000000000000003",
        amount: "42000000",
        asset: "USDC",
        from: "0xeee5555555555555555555555555555555555555",
        to: "0xfff6666666666666666666666666666666666666",
        transfer_id: "xfer:demo:3",
        memo_ids: [],
        job_ids: ["job:erc8183:5042002:8183"],
      },
    ],
  },
  confidence: "high",
  confidence_reasons: ["job_linked", "settlement_observed"],
  confidence_model_version: "0.1.0",
  evidence: paymentJobExplain.evidence,
  coverage: paymentJobExplain.coverage,
  graph_refs: paymentJobExplain.graph_refs,
};
