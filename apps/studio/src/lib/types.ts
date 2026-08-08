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
  fixture?: string;
}
