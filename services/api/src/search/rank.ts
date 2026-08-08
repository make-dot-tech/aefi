/** Fuse semantic similarity with graph performance score. */

export const SEMANTIC_WEIGHT = 0.35;
export const GRAPH_WEIGHT = 0.65;
export const SEMANTIC_MATCH_THRESHOLD = 0.35;

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
