import {
  DEMO_EXAMPLES,
  getExplainFixture,
  getVerifyFixture,
} from "../fixtures";
import {
  DEMO_SCENARIOS,
  fixtureSearchEnvelope,
} from "../fixtures/providers";
import type {
  AefiEnvelope,
  DemoExample,
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

export type DataMode = "fixture" | "live";

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

export async function fetchExamples(): Promise<DemoExample[]> {
  try {
    const res = await fetch(`${API_URL}/v1/demo/examples`);
    if (!res.ok) return DEMO_EXAMPLES;
    const body = (await res.json()) as { examples?: DemoExample[] };
    return body.examples?.length ? body.examples : DEMO_EXAMPLES;
  } catch {
    return DEMO_EXAMPLES;
  }
}

export async function fetchScenarios(): Promise<DemoScenario[]> {
  try {
    const res = await fetch(`${API_URL}/v1/demo/scenarios`);
    if (!res.ok) return DEMO_SCENARIOS;
    const body = (await res.json()) as { scenarios?: DemoScenario[] };
    return body.scenarios?.length ? body.scenarios : DEMO_SCENARIOS;
  } catch {
    return DEMO_SCENARIOS;
  }
}

export async function seedDemo(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${API_URL}/v1/demo/seed`, {
      method: "POST",
      headers: headers(),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      providers?: number;
      jobs?: number;
      error?: string;
    };
    if (!res.ok || !body.ok) {
      return { ok: false, detail: body.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      detail: `Seeded ${body.providers} providers / ${body.jobs} jobs`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "seed failed",
    };
  }
}

export async function searchProviders(
  filters: ProviderSearchFilters,
  preferLive: boolean,
): Promise<{ envelope: AefiEnvelope<ProviderSearchResult>; mode: DataMode }> {
  if (preferLive) {
    try {
      const res = await fetch(`${API_URL}/v1/providers/search`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(filters),
      });
      if (res.ok) {
        const envelope = (await res.json()) as AefiEnvelope<ProviderSearchResult>;
        if ((envelope.result?.results?.length ?? 0) > 0) {
          return { envelope, mode: "live" };
        }
        // empty live graph → fall through to fixtures for demo reliability
      }
    } catch {
      /* fixtures */
    }
  }
  return { envelope: fixtureSearchEnvelope(filters), mode: "fixture" };
}

export async function explainTransaction(
  hash: string,
  preferLive: boolean,
): Promise<{ envelope: AefiEnvelope<ExplainResult>; mode: DataMode }> {
  const fixture = getExplainFixture(hash);
  if (!preferLive && fixture) {
    return { envelope: fixture, mode: "fixture" };
  }
  if (preferLive) {
    try {
      const res = await fetch(
        `${API_URL}/v1/transactions/${encodeURIComponent(hash)}`,
        { headers: headers() },
      );
      if (res.ok) {
        const envelope = (await res.json()) as AefiEnvelope<ExplainResult>;
        const empty =
          !envelope.result ||
          !(envelope.result as ExplainResult).steps?.length;
        if (!empty) {
          return { envelope, mode: "live" };
        }
      }
    } catch {
      /* fall through */
    }
  }
  if (fixture) {
    return { envelope: fixture, mode: "fixture" };
  }
  // Synthetic explain from provider settlement hash for demo txs
  return {
    envelope: {
      summary: `Settlement ${hash.slice(0, 10)}… observed in provider evidence graph.`,
      result: {
        tx_hash: hash.toLowerCase(),
        steps: [
          {
            step: "settlement",
            transfer_id: `xfer:${hash.slice(0, 12)}`,
            from: "0xrequester00000000000000000000000000000001",
            to: "0xprovider00000000000000000000000000000001",
            value: "2500000",
          },
          {
            step: "payment",
            payment_id: `pay:${hash.slice(0, 12)}`,
            amount: "2500000",
          },
          { step: "job", job_id: "linked" },
        ],
      },
      confidence: "medium",
      confidence_reasons: ["job_linked", "settlement_observed"],
      confidence_model_version: "0.1.0",
      evidence: [
        {
          evidence_id: `ev:${hash.slice(0, 12)}`,
          type: "transfer",
          source: "arc:5042002",
          reference: hash,
        },
      ],
      coverage: {
        status: "partial",
        known_gaps: ["authorization_evidence_missing"],
      },
    },
    mode: "fixture",
  };
}

export async function verifyPayment(
  hash: string,
  preferLive: boolean,
): Promise<{ envelope: AefiEnvelope<VerifyResult>; mode: DataMode }> {
  const fixture = getVerifyFixture(hash);
  if (!preferLive && fixture) {
    return { envelope: fixture, mode: "fixture" };
  }
  if (preferLive) {
    try {
      const res = await fetch(`${API_URL}/v1/payments/verify`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ tx_hash: hash }),
      });
      if (res.ok) {
        const envelope = (await res.json()) as AefiEnvelope<VerifyResult>;
        if (envelope.result?.verified || !fixture) {
          return { envelope, mode: "live" };
        }
      }
    } catch {
      /* fall through */
    }
  }
  if (fixture) {
    return { envelope: fixture, mode: "fixture" };
  }
  throw new Error("No fixture or live verification for this hash.");
}

export { API_URL, DEMO_SCENARIOS };
