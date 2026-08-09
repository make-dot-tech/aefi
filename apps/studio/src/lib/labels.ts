import type { ProviderResult } from "./types";

/** Compact label when display_name is missing (long agent:wallet / erc8004 ids). */
export function providerLabel(p: Pick<ProviderResult, "display_name" | "provider_id">): string {
  if (p.display_name?.trim()) return p.display_name.trim();
  const id = p.provider_id;
  const wallet = id.match(/^agent:wallet:\d+:(0x[a-fA-F0-9]+)$/);
  if (wallet) {
    const addr = wallet[1]!;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  const erc = id.match(/^agent:erc8004:\d+:(.+)$/);
  if (erc) return `agent #${erc[1]}`;
  if (id.length > 28) return `${id.slice(0, 14)}…${id.slice(-6)}`;
  return id;
}

export function shortProviderId(id: string): string {
  if (id.length <= 36) return id;
  return `${id.slice(0, 18)}…${id.slice(-10)}`;
}
