import type {
  AefiEnvelope,
  DemoExample,
  ExplainResult,
  VerifyResult,
} from "../lib/types";
import { paymentJobExplain, paymentJobVerify } from "./payment-job";
import { paymentMemoExplain, paymentMemoVerify } from "./payment-memo";
import { paymentOnlyExplain, paymentOnlyVerify } from "./payment-only";

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

const explainByFixture: Record<string, AefiEnvelope<ExplainResult>> = {
  "payment-only": paymentOnlyExplain,
  "payment-memo": paymentMemoExplain,
  "payment-job": paymentJobExplain,
};

const verifyByFixture: Record<string, AefiEnvelope<VerifyResult>> = {
  "payment-only": paymentOnlyVerify,
  "payment-memo": paymentMemoVerify,
  "payment-job": paymentJobVerify,
};

export function fixtureIdForHash(txHash: string): string | null {
  const hit = DEMO_EXAMPLES.find(
    (e) => e.tx_hash.toLowerCase() === txHash.toLowerCase(),
  );
  return hit?.fixture ?? null;
}

export function getExplainFixture(
  txHash: string,
): AefiEnvelope<ExplainResult> | null {
  const id = fixtureIdForHash(txHash);
  return id ? (explainByFixture[id] ?? null) : null;
}

export function getVerifyFixture(
  txHash: string,
): AefiEnvelope<VerifyResult> | null {
  const id = fixtureIdForHash(txHash);
  return id ? (verifyByFixture[id] ?? null) : null;
}
