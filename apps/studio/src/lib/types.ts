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

export interface ExplainStep {
  step: string;
  transfer_id?: string;
  memo_id?: string;
  payment_id?: string;
  job_id?: string;
  from?: string;
  to?: string;
  value?: string;
  amount?: string;
  sender?: string;
}

export interface ExplainResult {
  tx_hash: string;
  steps: ExplainStep[];
  payments?: unknown[];
}

export interface VerifyPaymentRow {
  payment_id: string;
  tx_hash: string;
  amount: string;
  asset: string;
  from: string | null;
  to: string | null;
  transfer_id: string | null;
  memo_ids: string[];
  job_ids: string[];
}

export interface VerifyResult {
  verified: boolean;
  subject?: string;
  payments: VerifyPaymentRow[];
}

export interface EvidenceDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface ProviderResult {
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
    confidence: Confidence;
    evidence_distribution: EvidenceDistribution;
  };
  ranking_explanation: string[];
  score: number;
  graph_score?: number;
  semantic_similarity?: number | null;
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
  authorization_compatibility?: {
    service_allowed: boolean | null;
    estimated_price_within_limit: boolean | null;
    note?: string;
  };
}

export interface ProviderSearchResult {
  interpreted_filters: Record<string, unknown>;
  results: ProviderResult[];
  graph_provider_count?: number;
}

export interface ProviderSearchFilters {
  query?: string;
  capability?: string;
  minimum_verified_jobs?: number;
  minimum_completion_rate?: number;
  minimum_confidence?: Confidence;
  limit?: number;
  semantic_top_k?: number;
}

export interface DemoScenario {
  id: string;
  label: string;
  blurb: string;
  filters: ProviderSearchFilters;
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

export interface DemoExample {
  id: string;
  label: string;
  tx_hash: string;
  blurb: string;
}
