import {
  CONFIDENCE_MODEL_VERSION,
  type AefiEnvelope,
  type Confidence,
  type Coverage,
} from "../lib/envelope.js";

export interface Fact {
  code: string;
  present: boolean;
  strength?: "exact" | "strong" | "medium" | "weak";
  refs: string[];
}

export interface FactPayload {
  schema_version: string;
  subject: { type: string; id: string };
  facts: Fact[];
  evidence_types: string[];
  coverage: Coverage;
}

export interface DispositionResult {
  confidence: Confidence;
  confidence_reasons: string[];
  confidence_model_version: string;
  mandate_status?: string;
  task_status?: string;
  overall_status?: string;
}

/**
 * Local Wave A disposition (fallback when aefi-rules is down).
 * Prefer services/rules Drools via composeDisposition() in client.ts.
 */
export function composeDispositionLocal(payload: FactPayload): DispositionResult {
  const present = payload.facts.filter((f) => f.present);
  const reasons = present.map((f) => f.code);

  if (payload.coverage.known_gaps.includes("authorization_evidence_missing")) {
    if (!reasons.includes("authorization_evidence_missing")) {
      reasons.push("authorization_evidence_missing");
    }
  }

  if (present.length === 0) {
    return {
      confidence: "unverified",
      confidence_reasons:
        reasons.length > 0 ? reasons : ["insufficient_evidence"],
      confidence_model_version: CONFIDENCE_MODEL_VERSION,
    };
  }

  const coverageStatus =
    payload.coverage.status === "unknown" ? "partial" : payload.coverage.status;

  const hasExact = present.some((f) => f.strength === "exact");
  const hasStrong = present.some((f) => f.strength === "strong");

  let confidence: Confidence = "low";
  if (hasExact && coverageStatus !== "minimal") {
    confidence = "high";
  } else if (hasStrong || hasExact) {
    confidence = "medium";
  }

  if (
    confidence === "high" &&
    present.every((f) => f.code === "payment_only_observed") &&
    payload.coverage.known_gaps.length > 0
  ) {
    confidence = "medium";
  }

  return {
    confidence,
    confidence_reasons: reasons,
    confidence_model_version: CONFIDENCE_MODEL_VERSION,
  };
}

/** @deprecated Prefer async composeDisposition from client.ts */
export function composeDisposition(payload: FactPayload): DispositionResult {
  return composeDispositionLocal(payload);
}

export function envelopeFromDisposition<T>(
  summary: string,
  result: T | null,
  disposition: DispositionResult,
  coverage: Coverage,
  evidence: AefiEnvelope["evidence"] = [],
): AefiEnvelope<T> {
  return {
    summary,
    result,
    confidence: disposition.confidence,
    confidence_reasons: disposition.confidence_reasons,
    confidence_model_version: disposition.confidence_model_version,
    evidence,
    coverage,
  };
}

/** Honest empty response for Wave B/C tools before adapters/history exist. */
export function gapEnvelope(
  summary: string,
  gaps: string[],
  extraReasons: string[] = ["insufficient_evidence"],
): AefiEnvelope {
  return {
    summary,
    result: null,
    confidence: "unverified",
    confidence_reasons: [...extraReasons, "scaffold_stub"],
    confidence_model_version: CONFIDENCE_MODEL_VERSION,
    evidence: [],
    coverage: {
      status: "unknown",
      known_gaps: gaps,
    },
  };
}
