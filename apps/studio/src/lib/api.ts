import { DEMO_EXAMPLES, getExplainFixture, getVerifyFixture } from "../fixtures";
import type {
  AefiEnvelope,
  DemoExample,
  ExplainResult,
  VerifyResult,
} from "./types";

const API_URL = (import.meta.env.VITE_AEFI_API_URL ?? "http://localhost:8787").replace(
  /\/$/,
  "",
);
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
    const body = (await res.json()) as {
      ok?: boolean;
      neo4j?: string;
    };
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
  if (preferLive) {
    throw new Error("No evidence in live graph for this hash.");
  }
  throw new Error("No fixture or live evidence for this hash.");
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
        if (envelope.result?.verified) {
          return { envelope, mode: "live" };
        }
        if (!fixture) {
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

export { API_URL };
