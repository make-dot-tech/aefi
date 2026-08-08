import {
  buildPaymentRequired,
  paymentRequiredHeader,
  type PaymentRequired,
} from "./challenge.js";
import type { X402Config } from "./config.js";
import { loadX402Config } from "./config.js";
import {
  paymentResponseHeader,
  verifyPaymentSignature,
  type VerifyOk,
} from "./verify.js";

export { loadX402Config };
export type { X402Config };

export type GateDecision =
  | { allowed: true; settlement?: VerifyOk["settlement"]; paymentResponse?: string }
  | {
      allowed: false;
      status: 402 | 400;
      body: PaymentRequired | { error: string };
      paymentRequiredHeader?: string;
    };

/**
 * x402 gate for agent-facing HTTP.
 * - API key (x-aefi-api-key) bypasses paywall (human/dev path)
 * - Else require PAYMENT-SIGNATURE; challenge with PAYMENT-REQUIRED
 */
export async function x402Gate(
  path: string,
  headers: Headers,
  cfg: X402Config = loadX402Config(),
): Promise<GateDecision> {
  if (!cfg.enabled) {
    return { allowed: true };
  }

  const apiKey = headers.get("x-aefi-api-key");
  if (cfg.apiKey && apiKey && apiKey === cfg.apiKey) {
    return { allowed: true };
  }

  const sig =
    headers.get("payment-signature") ??
    headers.get("PAYMENT-SIGNATURE") ??
    headers.get("Payment-Signature");

  const required = buildPaymentRequired(path, cfg);

  if (!sig) {
    return {
      allowed: false,
      status: 402,
      body: required,
      paymentRequiredHeader: paymentRequiredHeader(required),
    };
  }

  const verified = await verifyPaymentSignature(sig, required, cfg);
  if (!verified.ok) {
    const failed = buildPaymentRequired(path, cfg, verified.error);
    return {
      allowed: false,
      status: verified.error === "invalid_payment_signature_encoding" ? 400 : 402,
      body: failed,
      paymentRequiredHeader: paymentRequiredHeader(failed),
    };
  }

  return {
    allowed: true,
    settlement: verified.settlement,
    paymentResponse: paymentResponseHeader(verified.settlement),
  };
}
