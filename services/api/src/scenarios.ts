/** Curated NL search presets grounded in Arc testnet agent activity (not seeded demos). */
export const SEARCH_SCENARIOS = [
  {
    id: "completed-providers",
    label: "Completed jobs",
    blurb: "Providers with at least one completed ERC-8183 job on Arc testnet.",
    filters: {
      query: "agent providers with completed jobs",
      minimum_verified_jobs: 1,
      minimum_completion_rate: 0.5,
      minimum_confidence: "unverified" as const,
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
      minimum_confidence: "unverified" as const,
    },
  },
  {
    id: "gateway-treasury",
    label: "Gateway treasury",
    blurb: "Gateway liquidity / treasury ops agents from live registrations.",
    filters: {
      query: "Gateway treasury liquidity drift detector",
      minimum_verified_jobs: 0,
      minimum_completion_rate: 0,
      minimum_confidence: "unverified" as const,
    },
  },
];
