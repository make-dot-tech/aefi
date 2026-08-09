import type { AefiEnvelope, VerifyResult } from "../lib/types";
import { formatAssetAmount } from "../lib/money";
import { ExplorerLink } from "./ExplorerLink";
import { LinkedText } from "./LinkedText";
import { Spinner } from "./Spinner";

interface Props {
  envelope: AefiEnvelope<VerifyResult> | null;
  loading: boolean;
  onVerify: () => void;
}

export function VerifyPanel({ envelope, loading, onVerify }: Props) {
  return (
    <section className="verify" aria-label="Lookup payment">
      <div className="verify-head">
        <h2>Lookup payment</h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onVerify}
          disabled={loading}
        >
          {loading ? <Spinner size="sm" label="Looking up" /> : "Lookup"}
        </button>
      </div>
      {envelope ? (
        <div className="verify-body">
          <p
            className={`verify-flag ${envelope.result?.verified ? "is-ok" : "is-no"}`}
          >
            {envelope.result?.verified ? "found in graph" : "not in graph"}
          </p>
          <p className="verify-summary">
            <LinkedText text={envelope.summary} />
          </p>
          {envelope.result?.payments?.map((p) => (
            <div key={p.payment_id} className="verify-row">
              <span>
                {formatAssetAmount(p.amount, {
                  asset: p.asset,
                  decimals: p.decimals,
                })}
              </span>
              <span className="mono verify-parties">
                <ExplorerLink value={p.from} kind="address" />
                <span aria-hidden="true"> → </span>
                <ExplorerLink value={p.to} kind="address" />
              </span>
              {p.tx_hash ? (
                <ExplorerLink value={p.tx_hash} kind="tx" className="mono" />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Look up this settlement in the evidence graph.</p>
      )}
    </section>
  );
}
