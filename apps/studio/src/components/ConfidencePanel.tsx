import type { AefiEnvelope } from "../lib/types";
import { LinkedText } from "./LinkedText";

interface Props {
  envelope: AefiEnvelope;
}

export function ConfidencePanel({ envelope }: Props) {
  return (
    <section className="confidence" aria-label="Confidence">
      <div className="confidence-head">
        <span className={`confidence-level is-${envelope.confidence}`}>
          {envelope.confidence}
        </span>
        <span className="confidence-coverage">
          coverage · {envelope.coverage.status}
        </span>
      </div>
      <p className="confidence-summary">
        <LinkedText text={envelope.summary} />
      </p>
      <div className="chip-row" aria-label="Reason codes">
        {envelope.confidence_reasons.map((r) => (
          <span key={r} className="chip chip-reason">
            {r}
          </span>
        ))}
      </div>
      {envelope.coverage.known_gaps.length > 0 ? (
        <div className="chip-row" aria-label="Coverage gaps">
          {envelope.coverage.known_gaps.map((g) => (
            <span key={g} className="chip chip-gap">
              gap · {g}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
