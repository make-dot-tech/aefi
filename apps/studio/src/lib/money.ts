/** Format on-chain token amounts for display (Arc USDC: native 18 / ERC-20 6). */

export const USDC_ERC20_DECIMALS = 6;
export const USDC_NATIVE_DECIMALS = 18;

export function resolveTokenDecimals(opts: {
  decimals?: number | string | null;
  asset?: string | null;
  amount?: string | null;
}): number {
  if (opts.decimals != null && opts.decimals !== "") {
    const n = Number(opts.decimals);
    if (Number.isFinite(n) && n >= 0 && n <= 36) return n;
  }

  const asset = String(opts.asset ?? "USDC").toUpperCase();
  if (asset.includes("EURC") || asset.includes("USYC")) return 6;
  if (!asset.includes("USDC")) return 18;

  // Arc dual USDC: system Transfer values are 18-dec; escrow/x402 often 6-dec.
  const raw = opts.amount?.trim();
  if (raw && /^\d+$/.test(raw)) {
    try {
      const n = BigInt(raw);
      if (n >= 10n ** 12n && n % 10n ** 12n === 0n) return USDC_NATIVE_DECIMALS;
    } catch {
      /* ignore */
    }
  }
  return USDC_ERC20_DECIMALS;
}

/** Human-readable amount string (no asset suffix). */
export function formatTokenAmount(
  amount: string | number | null | undefined,
  opts?: { decimals?: number | string | null; asset?: string | null },
): string {
  if (amount == null || amount === "") return "—";
  const raw = String(amount).trim();
  if (raw === "?" || raw === "—") return raw;
  if (!/^-?\d+$/.test(raw)) return raw;

  const decimals = resolveTokenDecimals({ ...opts, amount: raw });
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).replace(/^0+/, "") || "0";
  if (decimals === 0) return negative ? `-${digits}` : digits;

  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : whole;
  return negative ? `-${body}` : body;
}

/** e.g. "5.25 USDC" */
export function formatAssetAmount(
  amount: string | number | null | undefined,
  opts?: { decimals?: number | string | null; asset?: string | null },
): string {
  const asset = opts?.asset?.trim() || "USDC";
  const formatted = formatTokenAmount(amount, { ...opts, asset });
  if (formatted === "—" || formatted === "?") return formatted;
  return `${formatted} ${asset}`;
}
