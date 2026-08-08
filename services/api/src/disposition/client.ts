import {
  composeDispositionLocal,
  type DispositionResult,
  type FactPayload,
} from "./composer.js";

const DEFAULT_RULES_URL = "http://localhost:8090";

export async function composeDisposition(
  payload: FactPayload,
): Promise<DispositionResult> {
  const base = process.env.AEFI_RULES_URL ?? DEFAULT_RULES_URL;
  const enabled = process.env.AEFI_RULES_ENABLED !== "false";

  if (enabled) {
    try {
      const res = await fetch(`${base}/v1/disposition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: payload.schema_version,
          subject: payload.subject,
          facts: payload.facts,
          evidence_types: payload.evidence_types,
          coverage: payload.coverage,
          context: (payload as FactPayload & { context?: unknown }).context,
        }),
        signal: AbortSignal.timeout(Number(process.env.AEFI_RULES_TIMEOUT_MS ?? 3000)),
      });
      if (res.ok) {
        const body = (await res.json()) as DispositionResult;
        if (body.confidence && body.confidence_model_version) {
          return body;
        }
      } else {
        console.warn("aefi-rules non-OK", res.status);
      }
    } catch (err) {
      console.warn("aefi-rules unavailable, using local composer", err);
    }
  }

  return composeDispositionLocal(payload);
}
