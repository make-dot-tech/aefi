import type { Erc8004Row, Erc8183Row, MemoRow } from "../types.js";

const ADDR_RE = /^0x[a-f0-9]{40}$/;

/** Normalize to lowercase 0x + 40 hex, or null. */
export function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (hex.length < 40) return null;
  const addr = `0x${hex.slice(-40)}`;
  return ADDR_RE.test(addr) ? addr : null;
}

export function addAddress(into: Set<string>, value: unknown): void {
  const addr = normalizeAddress(value);
  if (addr) into.add(addr);
}

/** Wallets from ERC-8004 agentWallet metadata + ERC-8183 job parties. */
export function collectAgentWalletsFromRows(
  agents: Erc8004Row[],
  jobs: Erc8183Row[],
): Set<string> {
  const wallets = new Set<string>();

  for (const row of agents) {
    addAddress(wallets, extractAgentWallet(row));
  }

  for (const row of jobs) {
    const decoded = row.decoded ?? {};
    const payload = row.payload ?? {};
    for (const key of ["client", "provider", "evaluator"]) {
      addAddress(wallets, decoded[key]);
      addAddress(wallets, payload[key]);
    }
  }

  return wallets;
}

export function extractAgentWallet(row: Erc8004Row): string | null {
  const p = row.payload ?? {};
  if (row.event_kind === "MetadataSet") {
    const key = String(p.metadataKey ?? "");
    if (key === "agentWallet") {
      return normalizeAddress(p.metadataValue);
    }
  }
  return null;
}

/** Tx hashes that are job-scoped even if wallets are not yet known. */
export function collectAgentRelatedTxHashes(
  jobs: Erc8183Row[],
  memos: MemoRow[],
): Set<string> {
  const txs = new Set<string>();
  for (const j of jobs) {
    if (j.tx_hash) txs.add(j.tx_hash.toLowerCase());
  }
  for (const m of memos) {
    if (memoHasJobId(m) && m.tx_hash) txs.add(m.tx_hash.toLowerCase());
  }
  return txs;
}

export function memoHasJobId(m: MemoRow): boolean {
  const decoded = m.decoded ?? {};
  for (const key of ["jobId", "job_id", "jobID"]) {
    const v = decoded[key];
    if (v !== undefined && v !== null && String(v).length) return true;
  }
  if (m.payload?.startsWith("0x")) {
    try {
      const text = Buffer.from(m.payload.slice(2), "hex").toString("utf8");
      if (text.startsWith("{")) {
        const obj = JSON.parse(text) as Record<string, unknown>;
        for (const key of ["job_id", "jobId"]) {
          if (obj[key] != null) return true;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function isAgentRelatedTransfer(
  fromAddr: string,
  toAddr: string,
  txHash: string,
  agentWallets: Set<string>,
  agentRelatedTxHashes: Set<string>,
): boolean {
  const from = normalizeAddress(fromAddr);
  const to = normalizeAddress(toAddr);
  if (from && agentWallets.has(from)) return true;
  if (to && agentWallets.has(to)) return true;
  return agentRelatedTxHashes.has(txHash.toLowerCase());
}
