import type { X402Config } from "./config.js";
import { unb64json } from "./codec.js";
import { claimNonce } from "./nonce.js";
import type { PaymentRequired, PaymentRequirements } from "./challenge.js";
import { b64json } from "./codec.js";

export interface PaymentPayload {
  x402Version: number;
  resource?: { url?: string; description?: string; mimeType?: string };
  accepted?: PaymentRequirements;
  payload: {
    signature?: string;
    authorization?: {
      from?: string;
      to?: string;
      value?: string;
      validAfter?: string;
      validBefore?: string;
      nonce?: string;
    };
    paymentPermit?: Record<string, unknown>;
  };
}

export interface VerifyOk {
  ok: true;
  settlement: {
    success: true;
    payer: string;
    amount: string;
    network: string;
    mode: "facilitator" | "dev";
  };
}

export interface VerifyErr {
  ok: false;
  error: string;
}

export type VerifyResult = VerifyOk | VerifyErr;

export function parsePaymentSignature(header: string): PaymentPayload | null {
  try {
    return unb64json<PaymentPayload>(header.trim());
  } catch {
    return null;
  }
}

function structuralCheck(
  payload: PaymentPayload,
  required: PaymentRequired,
  cfg: X402Config,
): VerifyErr | { auth: NonNullable<PaymentPayload["payload"]["authorization"]>; accept: PaymentRequirements } {
  if (payload.x402Version !== 1 && payload.x402Version !== 2) {
    return { ok: false, error: "unsupported_x402_version" };
  }
  const accept = payload.accepted ?? required.accepts[0];
  if (!accept) return { ok: false, error: "missing_accepted_requirements" };

  const auth = payload.payload?.authorization;
  if (!auth?.from || !auth?.to || !auth?.value || !auth?.nonce) {
    return { ok: false, error: "malformed_authorization" };
  }
  if (auth.to.toLowerCase() !== cfg.payTo.toLowerCase()) {
    return { ok: false, error: "pay_to_mismatch" };
  }
  const requiredAmount = BigInt(required.accepts[0]?.maxAmountRequired ?? cfg.priceAtomic);
  let value: bigint;
  try {
    value = BigInt(auth.value);
  } catch {
    return { ok: false, error: "invalid_value" };
  }
  if (value < requiredAmount) {
    return { ok: false, error: "amount_too_low" };
  }
  if (!payload.payload.signature || !payload.payload.signature.startsWith("0x")) {
    return { ok: false, error: "missing_signature" };
  }
  return { auth, accept };
}

async function facilitatorVerify(
  payload: PaymentPayload,
  required: PaymentRequired,
  cfg: X402Config,
): Promise<VerifyResult> {
  if (!cfg.facilitatorUrl) {
    return { ok: false, error: "facilitator_not_configured" };
  }
  const url = `${cfg.facilitatorUrl.replace(/\/$/, "")}/verify`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      x402Version: payload.x402Version,
      paymentPayload: payload,
      paymentRequirements: required.accepts[0],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    return { ok: false, error: `facilitator_http_${res.status}` };
  }
  const body = (await res.json()) as { isValid?: boolean; invalidReason?: string };
  if (!body.isValid) {
    return { ok: false, error: body.invalidReason ?? "facilitator_invalid" };
  }
  const auth = payload.payload.authorization!;
  return {
    ok: true,
    settlement: {
      success: true,
      payer: auth.from!,
      amount: auth.value!,
      network: cfg.network,
      mode: "facilitator",
    },
  };
}

export async function verifyPaymentSignature(
  signatureHeader: string,
  required: PaymentRequired,
  cfg: X402Config,
): Promise<VerifyResult> {
  const payload = parsePaymentSignature(signatureHeader);
  if (!payload) return { ok: false, error: "invalid_payment_signature_encoding" };

  const checked = structuralCheck(payload, required, cfg);
  if ("ok" in checked && checked.ok === false) return checked;

  const { auth } = checked as {
    auth: NonNullable<PaymentPayload["payload"]["authorization"]>;
    accept: PaymentRequirements;
  };

  if (!claimNonce(auth.nonce!)) {
    return { ok: false, error: "nonce_replay" };
  }

  if (cfg.facilitatorUrl) {
    return facilitatorVerify(payload, required, cfg);
  }

  if (cfg.devAccept) {
    return {
      ok: true,
      settlement: {
        success: true,
        payer: auth.from!,
        amount: auth.value!,
        network: cfg.network,
        mode: "dev",
      },
    };
  }

  return { ok: false, error: "verification_unavailable" };
}

export function paymentResponseHeader(settlement: VerifyOk["settlement"]): string {
  return b64json({
    success: true,
    payer: settlement.payer,
    amount: settlement.amount,
    network: settlement.network,
    mode: settlement.mode,
  });
}
