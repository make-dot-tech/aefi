const PLACEHOLDER_PAY_TO = new Set([
  "",
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000aef1",
]);

export const X402_PRICE_USDC = "0.01";
export const X402_PRICE_AMOUNT = "0.010000";
export const X402_PRICE_CURRENCY = "USDC";
/** Public seller address (vanity 0xaef1…). Not a secret — 402 accepts[] advertise it. */
export const DEFAULT_PAY_TO = "0xaEF1f897140C9a01a291d9e09865B519c997691B";

/** Paid /v1 routes except these (studio presets stay free). */
export const FREE_V1_PATHS = new Set(["/v1/scenarios"]);

export interface X402Config {
  enabled: boolean;
  /** Human/studio bypass via x-aefi-api-key when this matches */
  apiKey: string | null;
  payTo: string;
  /** Decimal USDC charged per request (passed to gateway.require) */
  priceUsdc: string;
  /** Atomic USDC (6 decimals) */
  priceAtomic: string;
  resourceBaseUrl: string;
  facilitatorUrl: string | null;
  /** CAIP-2 networks; empty means all Gateway-supported chains */
  networks: string[];
}

export function isUsablePayTo(payTo: string): boolean {
  return /^0x[a-f0-9]{40}$/.test(payTo) && !PLACEHOLDER_PAY_TO.has(payTo);
}

export function loadX402Config(): X402Config {
  const priceUsdc = process.env.AEFI_X402_PRICE_USDC ?? X402_PRICE_USDC;
  const priceAtomic =
    process.env.AEFI_X402_PRICE_ATOMIC ??
    String(Math.round(Number(priceUsdc) * 1_000_000));
  const payTo = (process.env.AEFI_X402_PAY_TO ?? DEFAULT_PAY_TO).trim();
  const requested = process.env.AEFI_X402_ENABLED === "true";
  const usablePayTo = isUsablePayTo(payTo.toLowerCase());
  if (requested && !usablePayTo) {
    console.warn(
      "AEFI_X402_ENABLED=true but AEFI_X402_PAY_TO is missing or a placeholder; paywall stays off",
    );
  }

  const networks = (process.env.AEFI_X402_NETWORKS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    enabled: requested && usablePayTo,
    apiKey: process.env.AEFI_API_KEY || null,
    payTo,
    priceUsdc,
    priceAtomic,
    resourceBaseUrl: process.env.AEFI_RESOURCE_BASE_URL ?? "http://localhost:8787",
    facilitatorUrl: process.env.AEFI_X402_FACILITATOR_URL || null,
    networks,
  };
}

export function gatewayRequirePrice(cfg: X402Config): string {
  return cfg.priceUsdc.startsWith("$") ? cfg.priceUsdc : `$${cfg.priceUsdc}`;
}
