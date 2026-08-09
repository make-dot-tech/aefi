import { SEARCH_SCENARIOS } from "./scenarios";
import type {
  AefiEnvelope,
  DemoScenario,
  ExplainResult,
  ProviderSearchFilters,
  ProviderSearchResult,
  VerifyResult,
} from "./types";

const API_URL = (
  import.meta.env.VITE_AEFI_API_URL ?? "http://localhost:8787"
).replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_AEFI_API_KEY ?? "dev-local-key";

export type DataMode = "live" | "offline";

export interface HealthState {
  ok: boolean;
  neo4j: string;
  reachable: boolean;
}

function headers(): HeadersInit {
  return {
    "content-type": "application/json",
    "x-aefi-api-key": API_KEY,
  };
}

export async function fetchHealth(): Promise<HealthState> {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) {
      return { ok: false, neo4j: "unavailable", reachable: false };
    }
    const body = (await res.json()) as { ok?: boolean; neo4j?: string };
    return {
      ok: Boolean(body.ok),
      neo4j: body.neo4j ?? "unknown",
      reachable: true,
    };
  } catch {
    return { ok: false, neo4j: "unavailable", reachable: false };
  }
}

export async function fetchScenarios(): Promise<DemoScenario[]> {
  try {
    const res = await fetch(`${API_URL}/v1/scenarios`);
    if (!res.ok) return SEARCH_SCENARIOS;
    const body = (await res.json()) as { scenarios?: DemoScenario[] };
    return body.scenarios?.length ? body.scenarios : SEARCH_SCENARIOS;
  } catch {
    return SEARCH_SCENARIOS;
  }
}

export async function searchProviders(
  filters: ProviderSearchFilters,
): Promise<{ envelope: AefiEnvelope<ProviderSearchResult>; mode: DataMode }> {
  const res = await fetch(`${API_URL}/v1/providers/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(filters),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Provider search failed (HTTP ${res.status})`);
  }
  const envelope = (await res.json()) as AefiEnvelope<ProviderSearchResult>;
  return { envelope, mode: "live" };
}

export async function explainTransaction(
  hash: string,
): Promise<{ envelope: AefiEnvelope<ExplainResult>; mode: DataMode }> {
  const res = await fetch(
    `${API_URL}/v1/transactions/${encodeURIComponent(hash)}`,
    { headers: headers() },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Explain failed (HTTP ${res.status})`);
  }
  const envelope = (await res.json()) as AefiEnvelope<ExplainResult>;
  return { envelope, mode: "live" };
}

export async function verifyPayment(
  hash: string,
): Promise<{ envelope: AefiEnvelope<VerifyResult>; mode: DataMode }> {
  const res = await fetch(`${API_URL}/v1/payments/verify`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ tx_hash: hash }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Verify failed (HTTP ${res.status})`);
  }
  const envelope = (await res.json()) as AefiEnvelope<VerifyResult>;
  return { envelope, mode: "live" };
}

export { API_URL, SEARCH_SCENARIOS };
