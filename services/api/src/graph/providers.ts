import { getDriver } from "./queries.js";
import { getEmbeddings } from "../search/embeddings.js";
import { fuseScores } from "../search/rank.js";
import { vectorRecallProviders } from "../search/vector.js";

export interface ProviderSearchFilters {
  query?: string;
  capability?: string;
  minimum_verified_jobs?: number;
  minimum_completion_rate?: number;
  minimum_confidence?: "high" | "medium" | "low" | "unverified";
  limit?: number;
  semantic_top_k?: number;
}

export interface EvidenceDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface ProviderPerformance {
  provider_id: string;
  display_name: string | null;
  wallet: string | null;
  capabilities: string[];
  performance: {
    verified_jobs: number;
    completed_jobs: number;
    rejected_jobs: number;
    expired_jobs: number;
    completion_rate: number;
    payment_linked_jobs: number;
    feedback_events: number;
    confidence: "high" | "medium" | "low" | "unverified";
    evidence_distribution: EvidenceDistribution;
  };
  sample_jobs: Array<{
    job_id: string;
    outcome: string | null;
    tx_hash: string | null;
  }>;
  sample_settlements: Array<{
    tx_hash: string;
    payment_id: string | null;
    amount: string | null;
  }>;
  ranking_explanation: string[];
  /** Fused score (semantic + graph) when query present; else graph score. */
  score: number;
  graph_score: number;
  semantic_similarity: number | null;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v ?? 0);
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

export function scoreProvider(p: {
  verified_jobs: number;
  completion_rate: number;
  payment_linked_jobs: number;
  feedback_events: number;
  confidence: string;
}): { score: number; ranking_explanation: string[] } {
  const explanations: string[] = [];
  let score = 0;

  score += p.completion_rate * 100;
  if (p.completion_rate >= 0.95) {
    explanations.push("completion_rate_above_threshold");
  } else if (p.completion_rate >= 0.85) {
    explanations.push("completion_rate_acceptable");
  } else if (p.verified_jobs > 0) {
    explanations.push("completion_rate_below_peer_bar");
  }

  score += Math.log10(p.verified_jobs + 1) * 25;
  if (p.verified_jobs >= 20) {
    explanations.push("verified_job_count_above_threshold");
  } else if (p.verified_jobs >= 5) {
    explanations.push("verified_job_history_present");
  }

  const payRatio =
    p.verified_jobs > 0 ? p.payment_linked_jobs / p.verified_jobs : 0;
  score += payRatio * 15;
  if (payRatio >= 0.5) explanations.push("settlement_evidence_substantial");

  if (p.feedback_events > 0) {
    score += Math.min(12, p.feedback_events * 1.5);
    explanations.push("reputation_events_observed");
  }

  if (p.confidence === "high") {
    score += 10;
    explanations.push("high_evidence_confidence");
  } else if (p.confidence === "medium") {
    score += 4;
  }

  if (p.verified_jobs > 0 && p.completion_rate >= 0.9) {
    explanations.push("recent_successful_activity");
  }

  return { score: Math.round(score * 100) / 100, ranking_explanation: explanations };
}

export function deriveConfidence(input: {
  verified_jobs: number;
  completed_jobs: number;
  payment_linked_jobs: number;
  feedback_events: number;
}): {
  confidence: "high" | "medium" | "low" | "unverified";
  evidence_distribution: EvidenceDistribution;
} {
  if (input.verified_jobs === 0) {
    return {
      confidence: "unverified",
      evidence_distribution: { high: 0, medium: 0, low: 0 },
    };
  }

  const high = Math.min(
    input.completed_jobs,
    input.payment_linked_jobs + Math.floor(input.feedback_events / 2),
  );
  const medium = Math.max(
    0,
    input.completed_jobs - high + Math.min(input.feedback_events, 3),
  );
  const low = Math.max(0, input.verified_jobs - high - medium);

  let confidence: "high" | "medium" | "low" | "unverified" = "low";
  if (
    input.verified_jobs >= 10 &&
    input.payment_linked_jobs >= 5 &&
    input.completed_jobs / input.verified_jobs >= 0.9
  ) {
    confidence = "high";
  } else if (input.verified_jobs >= 5 && input.completed_jobs > 0) {
    confidence = "medium";
  }

  return {
    confidence,
    evidence_distribution: { high, medium, low },
  };
}

const CONF_RANK = { high: 3, medium: 2, low: 1, unverified: 0 } as const;

function mapRecord(rec: {
  get: (key: string) => unknown;
}): ProviderPerformance | null {
  const agentNode = rec.get("a") as { properties: Record<string, unknown> } | null;
  if (!agentNode?.properties) return null;
  const agent = agentNode.properties;
  const walletNode = rec.get("w") as { properties: Record<string, unknown> } | null;
  const wallet = walletNode?.properties ?? null;
  const jobs =
    (rec.get("jobs") as Array<{ properties: Record<string, unknown> }>) ?? [];
  const outcomes =
    (rec.get("outcomes") as Array<{ properties: Record<string, unknown> }>) ?? [];
  const payments =
    (rec.get("payments") as Array<{ properties: Record<string, unknown> }>) ?? [];

  const verified_jobs = toNum(rec.get("verified_jobs"));
  const completed_jobs = toNum(rec.get("completed_jobs"));
  const rejected_jobs = toNum(rec.get("rejected_jobs"));
  const expired_jobs = toNum(rec.get("expired_jobs"));
  const payment_linked_jobs = toNum(rec.get("payment_linked_jobs"));
  const feedback_events = toNum(rec.get("feedback_events"));
  const completion_rate =
    verified_jobs > 0 ? completed_jobs / verified_jobs : 0;

  const { confidence, evidence_distribution } = deriveConfidence({
    verified_jobs,
    completed_jobs,
    payment_linked_jobs,
    feedback_events,
  });

  const { score, ranking_explanation } = scoreProvider({
    verified_jobs,
    completion_rate,
    payment_linked_jobs,
    feedback_events,
    confidence,
  });

  const outcomeByJob = new Map<string, string>();
  for (const o of outcomes) {
    if (!o?.properties) continue;
    const jid = String(o.properties.job_id ?? "");
    if (jid) outcomeByJob.set(jid, String(o.properties.kind ?? ""));
  }

  const sample_jobs = jobs.slice(0, 6).map((j) => {
    const props = j.properties;
    const jid = String(props.job_id ?? props.id ?? "");
    return {
      job_id: jid,
      outcome:
        outcomeByJob.get(jid) ??
        (props.last_event ? String(props.last_event) : null),
      tx_hash: props.tx_hash ? String(props.tx_hash) : null,
    };
  });

  const sample_settlements = payments
    .filter((p) => p?.properties?.tx_hash)
    .slice(0, 5)
    .map((p) => ({
      tx_hash: String(p.properties.tx_hash),
      payment_id: p.properties.id ? String(p.properties.id) : null,
      amount: p.properties.amount != null ? String(p.properties.amount) : null,
    }));

  const caps = [
    ...asStringList(agent.capabilities),
    ...asStringList(agent.capability),
  ];

  return {
    provider_id: String(agent.id),
    display_name: agent.display_name
      ? String(agent.display_name)
      : agent.name
        ? String(agent.name)
        : null,
    wallet: wallet?.address
      ? String(wallet.address)
      : agent.wallet
        ? String(agent.wallet)
        : null,
    capabilities: [...new Set(caps.map((c) => c.toLowerCase()))],
    performance: {
      verified_jobs,
      completed_jobs,
      rejected_jobs,
      expired_jobs,
      completion_rate: Math.round(completion_rate * 1000) / 1000,
      payment_linked_jobs,
      feedback_events,
      confidence,
      evidence_distribution,
    },
    sample_jobs,
    sample_settlements,
    ranking_explanation,
    score,
    graph_score: score,
    semantic_similarity: null,
  };
}

export async function searchProviderPerformance(
  filters: ProviderSearchFilters = {},
): Promise<ProviderPerformance[]> {
  const session = getDriver().session();
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const capability = filters.capability?.trim().toLowerCase() || null;
  const minJobs = filters.minimum_verified_jobs ?? 0;
  const minRate = filters.minimum_completion_rate ?? 0;
  const minConf = filters.minimum_confidence ?? "unverified";
  const query = filters.query?.trim() || null;
  const topK = Math.min(Math.max(filters.semantic_top_k ?? 25, 1), 50);

  let semanticMap = new Map<string, number>();
  if (query) {
    try {
      const embedding = await getEmbeddings().embed(query);
      const hits = await vectorRecallProviders(embedding, topK);
      semanticMap = new Map(
        hits.map((h) => [h.provider_id, h.semantic_similarity]),
      );
    } catch (err) {
      console.warn(
        "semantic recall failed; continuing with graph-only ranking",
        err instanceof Error ? err.message : err,
      );
    }
  }

  try {
    // When semantic recall returned candidates, restrict to those IDs (plus
    // still allow empty map → full graph scan as fallback).
    const restrictIds =
      query && semanticMap.size > 0 ? [...semanticMap.keys()] : null;

    const result = await session.run(
      `
      MATCH (j:Job)-[:PROVIDER]->(a:Agent)
      WHERE $restrictIds IS NULL OR a.id IN $restrictIds
      OPTIONAL MATCH (j)-[:HAS_OUTCOME]->(o:Outcome)
      OPTIONAL MATCH (pay:Payment)-[:FOR_JOB]->(j)
      OPTIONAL MATCH (a)-[:CONTROLS]->(w:Wallet)
      OPTIONAL MATCH (ev:Evidence)-[:SUPPORTS]->(a)
      WITH a, head(collect(DISTINCT w)) AS w,
           collect(DISTINCT j) AS jobs,
           [x IN collect(DISTINCT o) WHERE x IS NOT NULL] AS outcomes,
           [x IN collect(DISTINCT pay) WHERE x IS NOT NULL] AS payments,
           [x IN collect(DISTINCT ev) WHERE x IS NOT NULL] AS feedback
      WITH a, w, jobs, outcomes, payments, feedback,
           size(jobs) AS verified_jobs,
           size([x IN outcomes WHERE x.kind = 'JobCompleted']) AS completed_jobs,
           size([x IN outcomes WHERE x.kind = 'JobRejected']) AS rejected_jobs,
           size([x IN outcomes WHERE x.kind = 'JobExpired']) AS expired_jobs,
           size(payments) AS payment_linked_jobs,
           size([e IN feedback WHERE e.type = 'reputation_event'
             OR e.event_kind = 'NewFeedback'
             OR toString(e.type) CONTAINS 'reputation']) AS feedback_events
      WHERE verified_jobs >= $minJobs
        AND (
          $capability IS NULL
          OR any(c IN coalesce(a.capabilities, []) WHERE toLower(toString(c)) = $capability)
          OR toLower(coalesce(a.capability, '')) = $capability
          OR any(j IN jobs WHERE toLower(coalesce(j.capability, '')) = $capability)
          OR any(j IN jobs WHERE toLower(coalesce(j.description, '')) CONTAINS $capability)
        )
      RETURN a, w, jobs, outcomes, payments, verified_jobs, completed_jobs,
             rejected_jobs, expired_jobs, payment_linked_jobs, feedback_events
      `,
      { minJobs, capability, restrictIds },
    );

    const rows: ProviderPerformance[] = [];
    for (const rec of result.records) {
      const mapped = mapRecord(rec);
      if (!mapped) continue;
      if (mapped.performance.completion_rate + 1e-9 < minRate) continue;
      if (CONF_RANK[mapped.performance.confidence] < CONF_RANK[minConf]) continue;

      const sem = semanticMap.get(mapped.provider_id) ?? null;
      mapped.semantic_similarity = sem;
      mapped.graph_score = mapped.score;
      rows.push(mapped);
    }

    const maxGraph = Math.max(...rows.map((r) => r.graph_score), 1);
    for (const row of rows) {
      const fused = fuseScores({
        semanticSimilarity: query ? row.semantic_similarity : null,
        graphScore: row.graph_score,
        maxGraphScore: maxGraph,
      });
      row.score = fused.fused;
      row.ranking_explanation = [
        ...fused.reasons,
        ...row.ranking_explanation,
      ];
    }

    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, limit);
  } finally {
    await session.close();
  }
}

export async function getProviderPerformance(
  providerId: string,
): Promise<ProviderPerformance | null> {
  const key = providerId.toLowerCase();
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (j:Job)-[:PROVIDER]->(a:Agent)
      WHERE toLower(a.id) = $key
         OR toLower(coalesce(a.wallet, '')) = $key
         OR toLower(coalesce(a.display_name, '')) = $key
      OPTIONAL MATCH (j)-[:HAS_OUTCOME]->(o:Outcome)
      OPTIONAL MATCH (pay:Payment)-[:FOR_JOB]->(j)
      OPTIONAL MATCH (a)-[:CONTROLS]->(w:Wallet)
      OPTIONAL MATCH (ev:Evidence)-[:SUPPORTS]->(a)
      WITH a, head(collect(DISTINCT w)) AS w,
           collect(DISTINCT j) AS jobs,
           [x IN collect(DISTINCT o) WHERE x IS NOT NULL] AS outcomes,
           [x IN collect(DISTINCT pay) WHERE x IS NOT NULL] AS payments,
           [x IN collect(DISTINCT ev) WHERE x IS NOT NULL] AS feedback
      WITH a, w, jobs, outcomes, payments, feedback,
           size(jobs) AS verified_jobs,
           size([x IN outcomes WHERE x.kind = 'JobCompleted']) AS completed_jobs,
           size([x IN outcomes WHERE x.kind = 'JobRejected']) AS rejected_jobs,
           size([x IN outcomes WHERE x.kind = 'JobExpired']) AS expired_jobs,
           size(payments) AS payment_linked_jobs,
           size([e IN feedback WHERE e.type = 'reputation_event'
             OR e.event_kind = 'NewFeedback'
             OR toString(e.type) CONTAINS 'reputation']) AS feedback_events
      RETURN a, w, jobs, outcomes, payments, verified_jobs, completed_jobs,
             rejected_jobs, expired_jobs, payment_linked_jobs, feedback_events
      LIMIT 1
      `,
      { key },
    );
    const rec = result.records[0];
    return rec ? mapRecord(rec) : null;
  } finally {
    await session.close();
  }
}

export async function countProviders(): Promise<number> {
  const session = getDriver().session();
  try {
    const res = await session.run(
      `MATCH (:Job)-[:PROVIDER]->(a:Agent) RETURN count(DISTINCT a) AS n`,
    );
    return toNum(res.records[0]?.get("n"));
  } finally {
    await session.close();
  }
}
