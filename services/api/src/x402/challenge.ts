import type { X402Config } from "./config.js";
import { priceForPath } from "./config.js";
import { b64json } from "./codec.js";

export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: Record<string, string>;
}

export interface PaymentRequired {
  x402Version: number;
  error: string;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: PaymentRequirements[];
}

export function buildPaymentRequired(
  path: string,
  cfg: X402Config,
  error = "PAYMENT-SIGNATURE header is required",
): PaymentRequired {
  const url = `${cfg.resourceBaseUrl}${path}`;
  const amount = priceForPath(path, cfg);
  const req: PaymentRequirements = {
    scheme: "exact",
    network: cfg.network,
    maxAmountRequired: amount,
    resource: url,
    description: `aefi ${path}`,
    mimeType: "application/json",
    payTo: cfg.payTo,
    maxTimeoutSeconds: 120,
    asset: cfg.asset,
    extra: {
      name: cfg.schemeExtraName,
      version: "2",
      chainId: String(cfg.chainId),
      verifyingContract: cfg.verifyingContract,
    },
  };
  return {
    x402Version: 2,
    error,
    resource: {
      url,
      description: "aefi evidence API",
      mimeType: "application/json",
    },
    accepts: [req],
  };
}

export function paymentRequiredHeader(required: PaymentRequired): string {
  return b64json(required);
}
