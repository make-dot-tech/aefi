import type { AefiEnvelope, VerifyResult } from "../lib/types";
import { Spinner } from "./Spinner";

interface Props {
  envelope: AefiEnvelope<VerifyResult> | null;
  loading: boolean;
  onVerify: () => void;
}

function short(v: string | null | undefined): string {
  if (!v) return "—";
  if (v.length < 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

export function VerifyPanel({ envelope, loading, onVerify }: Props) {
  return (
    <section className="verify" aria-label="Verify payment">
      <div className="verify-head">
        <h2>Verify payment</h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onVerify}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" label="Verifying" /> : "Verify"}
        </button>
      </div>
      {envelope ? (
        <div className="verify-body">
          <p
            className={`verify-flag ${envelope.result?.verified ? "is-ok" : "is-no"}`}
          >
            {envelope.result?.verified ? "verified" : "not verified"}
          </p>
          <p className="verify-summary">{envelope.summary}</p>
          {envelope.result?.payments?.map((p) => (
            <div key={p.payment_id} className="verify-row">
              <span>
                {p.amount} {p.asset}
              </span>
              <span className="mono">
                {short(p.from)} → {short(p.to)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Confirm settlement against the evidence graph.</p>
      )}
    </section>
  );
}
