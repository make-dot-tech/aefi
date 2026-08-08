export interface X402Config {
  enabled: boolean;
  /** Human/dev bypass via x-aefi-api-key when this matches */
  apiKey: string | null;
  payTo: string;
  /** Atomic USDC (6 decimals) charged per request */
  priceAtomic: string;
  chainId: number;
  network: string;
  asset: string;
  resourceBaseUrl: string;
  facilitatorUrl: string | null;
  /** Accept structurally valid payloads without onchain/facilitator verify (local only) */
  devAccept: boolean;
  schemeExtraName: string;
  verifyingContract: string;
}

export function loadX402Config(): X402Config {
  const priceUsdc = process.env.AEFI_X402_PRICE_USDC ?? "0.01";
  const priceAtomic =
    process.env.AEFI_X402_PRICE_ATOMIC ??
    String(Math.round(Number(priceUsdc) * 1_000_000));

  return {
    enabled: process.env.AEFI_X402_ENABLED === "true",
    apiKey: process.env.AEFI_API_KEY ?? null,
    payTo: (
      process.env.AEFI_X402_PAY_TO ??
      "0x000000000000000000000000000000000000aef1"
    ).toLowerCase(),
    priceAtomic,
    chainId: Number(process.env.ARC_CHAIN_ID ?? 5042002),
    network: process.env.AEFI_X402_NETWORK ?? "eip155:5042002",
    asset: (
      process.env.AEFI_X402_ASSET ??
      "0x3600000000000000000000000000000000000000"
    ).toLowerCase(),
    resourceBaseUrl: process.env.AEFI_RESOURCE_BASE_URL ?? "http://localhost:8787",
    facilitatorUrl: process.env.AEFI_X402_FACILITATOR_URL || null,
    devAccept: process.env.AEFI_X402_DEV_ACCEPT !== "false",
    schemeExtraName: process.env.AEFI_X402_SCHEME_NAME ?? "USDC",
    verifyingContract: (
      process.env.AEFI_X402_VERIFYING_CONTRACT ??
      "0x3600000000000000000000000000000000000000"
    ).toLowerCase(),
  };
}

export function priceForPath(path: string, cfg: X402Config): string {
  // Flat price for all tools in #6; per-tool overrides can land later.
  void path;
  return cfg.priceAtomic;
}
