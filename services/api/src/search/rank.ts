/** Fuse semantic similarity with graph performance score. */

export const SEMANTIC_WEIGHT = 0.35;
export const GRAPH_WEIGHT = 0.65;
export const SEMANTIC_MATCH_THRESHOLD = 0.35;

/**
 * When performance floors are set (e.g. Completed jobs preset), semantic recall
 * must soft-rank — not hard-restrict — or job providers outside the vector
 * neighborhood disappear. Capability-only discovery (no floors) may still
 * hard-restrict to semantic hits.
 */
export function shouldHardRestrictSemantic(input: {
  minimum_verified_jobs?: number;
  minimum_completion_rate?: number;
  minimum_confidence?: "high" | "medium" | "low" | "unverified";
}): boolean {
  const minJobs = input.minimum_verified_jobs ?? 0;
  const minRate = input.minimum_completion_rate ?? 0;
  const minConf = input.minimum_confidence ?? "unverified";
  if (minJobs > 0 || minRate > 0) return false;
  if (minConf !== "unverified") return false;
  return true;
}

export const PROVIDER_SORT_BY = [
  "score",
  "verified_jobs",
  "completion_rate",
  "recent",
] as const;
export type ProviderSortBy = (typeof PROVIDER_SORT_BY)[number];
export type ProviderSortDir = "asc" | "desc";

export function fuseScores(input: {
  semanticSimilarity: number | null;
  graphScore: number;
  maxGraphScore: number;
}): {
  fused: number;
  graph_score_normalized: number;
  semantic_similarity: number | null;
  reasons: string[];
} {
  const maxG = Math.max(input.maxGraphScore, 1e-6);
  const graphNorm = input.graphScore / maxG;
  const reasons: string[] = [];

  let fused: number;
  if (input.semanticSimilarity == null) {
    fused = input.graphScore;
  } else {
    const sem = Math.max(0, Math.min(1, input.semanticSimilarity));
    fused =
      SEMANTIC_WEIGHT * (sem * 100) + GRAPH_WEIGHT * (graphNorm * 100);
    if (sem >= SEMANTIC_MATCH_THRESHOLD) {
      reasons.push("capability_semantic_match");
    } else if (sem > 0.15) {
      reasons.push("capability_weak_semantic_match");
    }
  }

  return {
    fused: Math.round(fused * 100) / 100,
    graph_score_normalized: Math.round(graphNorm * 1000) / 1000,
    semantic_similarity: input.semanticSimilarity,
    reasons,
  };
}

/** Minimal row shape needed to sort + page provider search results. */
export interface SortableProviderRow {
  provider_id: string;
  score: number;
  performance: {
    verified_jobs: number;
    completion_rate: number;
  };
  identity: {
    last_block: number | null;
    last_tx: string | null;
  };
}

function primarySortValue(
  row: SortableProviderRow,
  sortBy: ProviderSortBy,
): number | string | null {
  switch (sortBy) {
    case "verified_jobs":
      return row.performance.verified_jobs;
    case "completion_rate":
      return row.performance.completion_rate;
    case "recent":
      return row.identity.last_block;
    case "score":
    default:
      return row.score;
  }
}

function compareNullable(
  a: number | string | null,
  b: number | string | null,
  dir: ProviderSortDir,
): number {
  // Nulls always last regardless of direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return dir === "asc" ? -1 : 1;
  if (a > b) return dir === "asc" ? 1 : -1;
  return 0;
}

/**
 * Sort providers by requested key, then stable tie-break on provider_id.
 * Does not mutate the input array.
 */
export function sortProviders<T extends SortableProviderRow>(
  rows: T[],
  sortBy: ProviderSortBy = "score",
  sortDir: ProviderSortDir = "desc",
): T[] {
  return [...rows].sort((a, b) => {
    const primary = compareNullable(
      primarySortValue(a, sortBy),
      primarySortValue(b, sortBy),
      sortDir,
    );
    if (primary !== 0) return primary;
    // For "recent", prefer lexicographically larger last_tx when blocks tie.
    if (sortBy === "recent") {
      const tx = compareNullable(
        a.identity.last_tx,
        b.identity.last_tx,
        sortDir,
      );
      if (tx !== 0) return tx;
    }
    return a.provider_id < b.provider_id
      ? -1
      : a.provider_id > b.provider_id
        ? 1
        : 0;
  });
}

export function pageProviders<T>(
  rows: T[],
  offset: number,
  limit: number,
): { items: T[]; total_matched: number; has_more: boolean } {
  const total_matched = rows.length;
  const start = Math.max(0, offset);
  const items = rows.slice(start, start + limit);
  return {
    items,
    total_matched,
    has_more: start + items.length < total_matched,
  };
}
