export interface DemoExample {
  id: string;
  label: string;
  tx_hash: string;
  blurb: string;
  fixture?: string;
}

/** Curated demo txs — hashes match studio fixtures; live graph may or may not contain them. */
export const DEMO_EXAMPLES: DemoExample[] = [
  {
    id: "payment-only",
    label: "Settlement only",
    tx_hash:
      "0xdemo000000000000000000000000000000000000000000000000000000000001",
    blurb: "USDC transfer observed; no memo or job link yet.",
    fixture: "payment-only",
  },
  {
    id: "payment-memo",
    label: "Payment + memo",
    tx_hash:
      "0xdemo000000000000000000000000000000000000000000000000000000000002",
    blurb: "Same-tx memo annotates the settlement path.",
    fixture: "payment-memo",
  },
  {
    id: "payment-job",
    label: "Payment + job",
    tx_hash:
      "0xdemo000000000000000000000000000000000000000000000000000000000003",
    blurb: "Settlement linked to an ERC-8183 job — richer evidence.",
    fixture: "payment-job",
  },
];
