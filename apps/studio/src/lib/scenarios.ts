/** Local fallback when API /v1/scenarios is unreachable — mirrors services/api scenarios. */
import type { DemoScenario } from "./types";

export const SEARCH_SCENARIOS: DemoScenario[] = [
  {
    id: "gateway-treasury",
    label: "Gateway treasury",
    blurb: "Gateway liquidity / treasury ops agents from live registrations.",
    filters: {
      query: "Gateway treasury liquidity drift detector",
      minimum_verified_jobs: 0,
      minimum_completion_rate: 0,
      minimum_confidence: "unverified",
    },
  },
  {
    id: "cross-chain-cctp",
    label: "CCTP · cross-chain",
    blurb: "Natural language recall for CCTP / cross-chain settlement skills.",
    filters: {
      query: "CCTP cross-chain settlement attestation tracker on Arc",
      minimum_verified_jobs: 0,
      minimum_completion_rate: 0,
      minimum_confidence: "unverified",
    },
  },
  {
    id: "completed-providers",
    label: "Completed jobs",
    blurb: "Providers with at least one completed ERC-8183 job on Arc testnet.",
    filters: {
      query: "providers with completed jobs and settlement evidence",
      minimum_verified_jobs: 1,
      minimum_completion_rate: 0,
      minimum_confidence: "unverified",
    },
  },
];
