import type {
  AefiEnvelope,
  DemoScenario,
  ProviderResult,
  ProviderSearchFilters,
  ProviderSearchResult,
} from "../lib/types";

function perf(
  partial: ProviderResult["performance"] & {
    display_name: string;
    id: string;
    wallet: string;
    caps: string[];
    score: number;
    graph_score: number;
    semantic_similarity: number | null;
    reasons: string[];
  },
): ProviderResult {
  return {
    provider_id: partial.id,
    display_name: partial.display_name,
    wallet: partial.wallet,
    capabilities: partial.caps,
    performance: {
      verified_jobs: partial.verified_jobs,
      completed_jobs: partial.completed_jobs,
      rejected_jobs: partial.rejected_jobs,
      expired_jobs: partial.expired_jobs,
      completion_rate: partial.completion_rate,
      payment_linked_jobs: partial.payment_linked_jobs,
      feedback_events: partial.feedback_events,
      confidence: partial.confidence,
      evidence_distribution: partial.evidence_distribution,
    },
    ranking_explanation: partial.reasons,
    score: partial.score,
    graph_score: partial.graph_score,
    semantic_similarity: partial.semantic_similarity,
    sample_jobs: [
      {
        job_id: `${partial.display_name.toLowerCase()}-1`,
        outcome: "JobCompleted",
        tx_hash: `0xdemo${partial.display_name.slice(0, 4).toLowerCase()}0000000000000000000000000000000000000000000000000001`,
      },
    ],
    sample_settlements: [
      {
        tx_hash: `0xdemo${partial.display_name.slice(0, 4).toLowerCase()}0000000000000000000000000000000000000000000000000001`,
        payment_id: `pay:demo:${partial.display_name.toLowerCase()}`,
        amount: "2500000",
      },
    ],
    authorization_compatibility: {
      service_allowed: null,
      estimated_price_within_limit: null,
      note: "Mandate/task adapters not wired — authorization_evidence_missing.",
    },
  };
}

export const FIXTURE_PROVIDERS: ProviderResult[] = [
  perf({
    id: "agent:demo:nova",
    display_name: "NovaFeed",
    wallet: "0xnova000000000000000000000000000000000001",
    caps: ["market-data", "price-oracle"],
    verified_jobs: 48,
    completed_jobs: 47,
    rejected_jobs: 1,
    expired_jobs: 0,
    completion_rate: 0.979,
    payment_linked_jobs: 44,
    feedback_events: 18,
    confidence: "high",
    evidence_distribution: { high: 40, medium: 6, low: 2 },
    score: 152.4,
    graph_score: 152.4,
    semantic_similarity: 0.82,
    reasons: [
      "capability_semantic_match",
      "completion_rate_above_threshold",
      "verified_job_count_above_threshold",
      "settlement_evidence_substantial",
      "high_evidence_confidence",
    ],
  }),
  perf({
    id: "agent:demo:pulse",
    display_name: "PulseOracle",
    wallet: "0xpulse00000000000000000000000000000000002",
    caps: ["market-data"],
    verified_jobs: 31,
    completed_jobs: 27,
    rejected_jobs: 3,
    expired_jobs: 1,
    completion_rate: 0.871,
    payment_linked_jobs: 17,
    feedback_events: 7,
    confidence: "medium",
    evidence_distribution: { high: 14, medium: 10, low: 7 },
    score: 118.2,
    graph_score: 118.2,
    semantic_similarity: 0.71,
    reasons: [
      "capability_semantic_match",
      "completion_rate_acceptable",
      "verified_job_count_above_threshold",
    ],
  }),
  perf({
    id: "agent:demo:cheap",
    display_name: "CheapTicks",
    wallet: "0xcheap00000000000000000000000000000000003",
    caps: ["market-data"],
    verified_jobs: 22,
    completed_jobs: 15,
    rejected_jobs: 5,
    expired_jobs: 2,
    completion_rate: 0.682,
    payment_linked_jobs: 8,
    feedback_events: 2,
    confidence: "low",
    evidence_distribution: { high: 4, medium: 6, low: 12 },
    score: 86.1,
    graph_score: 86.1,
    semantic_similarity: 0.58,
    reasons: [
      "capability_semantic_match",
      "completion_rate_below_peer_bar",
      "verified_job_count_above_threshold",
    ],
  }),
  perf({
    id: "agent:demo:helix",
    display_name: "HelixResearch",
    wallet: "0xhelix00000000000000000000000000000000004",
    caps: ["research-ops", "report-writing"],
    verified_jobs: 27,
    completed_jobs: 26,
    rejected_jobs: 1,
    expired_jobs: 0,
    completion_rate: 0.963,
    payment_linked_jobs: 24,
    feedback_events: 11,
    confidence: "high",
    evidence_distribution: { high: 22, medium: 4, low: 1 },
    score: 141.7,
    graph_score: 141.7,
    semantic_similarity: 0.22,
    reasons: [
      "completion_rate_above_threshold",
      "verified_job_count_above_threshold",
      "high_evidence_confidence",
    ],
  }),
];

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "price-feeds-intent",
    label: "Price feeds · NL intent",
    blurb: "“reliable on-chain price feeds for trading agents” — no exact tag required.",
    filters: {
      query: "reliable on-chain price feeds for trading agents",
      minimum_verified_jobs: 10,
      minimum_completion_rate: 0.5,
      minimum_confidence: "low",
    },
  },
  {
    id: "market-data-elite",
    label: "Market data · elite bar",
    blurb: "Semantic intent + ≥95% completion — who survives objective filters?",
    filters: {
      query: "market data oracle with high reliability",
      minimum_verified_jobs: 20,
      minimum_completion_rate: 0.95,
      minimum_confidence: "medium",
    },
  },
  {
    id: "research-ops",
    label: "Research ops · NL",
    blurb: "“research reports and analysis agents” → HelixResearch.",
    filters: {
      query: "research reports and analysis for agent workflows",
      minimum_verified_jobs: 10,
      minimum_completion_rate: 0.9,
      minimum_confidence: "medium",
    },
  },
];

const CONF_RANK = { high: 3, medium: 2, low: 1, unverified: 0 } as const;

/** Simple bag-of-words similarity for offline fixture semantic ranking. */
function fixtureSemantic(query: string | undefined, p: ProviderResult): number {
  if (!query?.trim()) return p.semantic_similarity ?? 0;
  const q = query.toLowerCase();
  const hay = [
    p.display_name ?? "",
    ...p.capabilities,
    ...(p.ranking_explanation ?? []),
  ]
    .join(" ")
    .toLowerCase();

  // Intent heuristics for demo wow without a live embedder
  if (/price|oracle|market|feed|trading|usdc|tick/.test(q)) {
    if (p.provider_id.includes("nova")) return 0.84;
    if (p.provider_id.includes("pulse")) return 0.72;
    if (p.provider_id.includes("cheap")) return 0.61;
    if (p.provider_id.includes("helix")) return 0.18;
  }
  if (/research|report|analysis|writing/.test(q)) {
    if (p.provider_id.includes("helix")) return 0.88;
    if (p.provider_id.includes("nova")) return 0.25;
    return 0.15;
  }
  const tokens = q.split(/\W+/).filter((t) => t.length > 3);
  if (tokens.length === 0) return 0.3;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return Math.min(0.95, 0.2 + hits / tokens.length);
}

export function filterFixtureProviders(
  filters: ProviderSearchFilters,
): ProviderResult[] {
  const cap = filters.capability?.toLowerCase();
  const minJobs = filters.minimum_verified_jobs ?? 0;
  const minRate = filters.minimum_completion_rate ?? 0;
  const minConf = filters.minimum_confidence ?? "unverified";

  const maxGraph = Math.max(...FIXTURE_PROVIDERS.map((p) => p.graph_score ?? p.score), 1);

  return FIXTURE_PROVIDERS.map((p) => {
    const sem = fixtureSemantic(filters.query, p);
    const graph = p.graph_score ?? p.score;
    const graphNorm = graph / maxGraph;
    const fused = filters.query
      ? Math.round((0.35 * sem * 100 + 0.65 * graphNorm * 100) * 100) / 100
      : graph;
    const reasons = [...p.ranking_explanation];
    if (filters.query && sem >= 0.35 && !reasons.includes("capability_semantic_match")) {
      reasons.unshift("capability_semantic_match");
    }
    return {
      ...p,
      semantic_similarity: filters.query ? sem : p.semantic_similarity,
      graph_score: graph,
      score: fused,
      ranking_explanation: reasons,
    };
  })
    .filter((p) => {
      if (p.performance.verified_jobs < minJobs) return false;
      if (p.performance.completion_rate + 1e-9 < minRate) return false;
      if (CONF_RANK[p.performance.confidence] < CONF_RANK[minConf]) return false;
      if (cap && !p.capabilities.some((c) => c === cap)) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

export function fixtureSearchEnvelope(
  filters: ProviderSearchFilters,
): AefiEnvelope<ProviderSearchResult> {
  const results = filterFixtureProviders(filters);
  const top = results[0];
  const queryBit = filters.query ? ` Intent: “${filters.query}”.` : "";
  return {
    summary: top
      ? `Found ${results.length} provider(s). Top match: ${top.display_name} (${(top.performance.completion_rate * 100).toFixed(1)}% completion across ${top.performance.verified_jobs} jobs).${queryBit}`
      : "No providers matched the structured filters.",
    result: {
      interpreted_filters: { ...filters },
      results,
      graph_provider_count: FIXTURE_PROVIDERS.length,
    },
    confidence: top?.performance.confidence ?? "unverified",
    confidence_reasons: top?.ranking_explanation ?? ["insufficient_evidence"],
    confidence_model_version: "0.1.0",
    evidence: results.slice(0, 3).map((p) => ({
      evidence_id: `ev:fixture:${p.provider_id}`,
      type: "provider_performance",
      source: "fixture",
      reference: p.provider_id,
      supports: [p.provider_id],
    })),
    coverage: {
      status: "partial",
      known_gaps: ["authorization_evidence_missing"],
    },
    graph_refs: { node_ids: results.map((p) => p.provider_id) },
  };
}
