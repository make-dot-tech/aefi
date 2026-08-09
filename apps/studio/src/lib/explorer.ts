/** Arc block explorer bases by chain id. */
const EXPLORER_BY_CHAIN: Record<string, string> = {
  "5042002": "https://testnet.arcscan.app",
};

const MAINNET_EXPLORER = "https://arcscan.app";

export function defaultChainId(): string {
  return String(import.meta.env.VITE_ARC_CHAIN_ID ?? "5042002");
}

export function explorerBase(chainId: string | number | null | undefined): string {
  const id = String(chainId ?? defaultChainId());
  return EXPLORER_BY_CHAIN[id] ?? MAINNET_EXPLORER;
}

export function addressExplorerUrl(
  address: string,
  chainId?: string | number | null,
): string {
  return `${explorerBase(chainId)}/address/${normalizeHex(address)}`;
}

export function txExplorerUrl(
  txHash: string,
  chainId?: string | number | null,
): string {
  return `${explorerBase(chainId)}/tx/${normalizeHex(txHash)}`;
}

export function looksLikeAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function looksLikeTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function shortHex(value: string, head = 6, tail = 4): string {
  const v = value.trim();
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function normalizeHex(value: string): string {
  const v = value.trim();
  return v.startsWith("0x") ? v : `0x${v}`;
}
