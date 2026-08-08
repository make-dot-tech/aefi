export type Confidence = "high" | "medium" | "low" | "unverified";

export type CoverageStatus =
  | "complete"
  | "substantial"
  | "partial"
  | "minimal"
  | "unknown";

export interface Coverage {
  status: CoverageStatus;
  known_gaps: string[];
}

export interface EvidenceRef {
  evidence_id: string;
  type: string;
  source: string;
  reference: string;
  supports?: string[];
}

export interface AefiEnvelope<T = unknown> {
  summary: string;
  result: T | null;
  confidence: Confidence;
  confidence_reasons: string[];
  confidence_model_version: string;
  evidence: EvidenceRef[];
  coverage: Coverage;
  graph_refs?: { node_ids: string[] };
}

export const CONFIDENCE_MODEL_VERSION = "0.1.0";
