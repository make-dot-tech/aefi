import type { ProviderResult } from "../lib/types";
import { ExplorerLink } from "./ExplorerLink";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

interface Props {
  provider: ProviderResult;
  onExplain: (txHash: string) => void;
  onClose: () => void;
  explainBusy?: boolean;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function ProviderDetail({
  provider,
  onExplain,
  onClose,
  explainBusy = false,
}: Props) {
  const p = provider.performance;
  const settlement = provider.sample_settlements[0];

  return (
    <Modal
      title={provider.display_name ?? provider.provider_id}
      onClose={onClose}
      size="md"
      subtitle={
        <span className="provider-id mono">{provider.provider_id}</span>
      }
    >
      {provider.wallet ? (
        <p className="mono muted">
          <ExplorerLink value={provider.wallet} kind="address" />
        </p>
      ) : null}

      <div className="detail-stats">
        <div>
          <span className="metric-label">completion</span>
          <span className="metric-value">{pct(p.completion_rate)}</span>
        </div>
        <div>
          <span className="metric-label">verified jobs</span>
          <span className="metric-value">{p.verified_jobs}</span>
        </div>
        <div>
          <span className="metric-label">completed</span>
          <span className="metric-value">{p.completed_jobs}</span>
        </div>
        <div>
          <span className="metric-label">rejected</span>
          <span className="metric-value">{p.rejected_jobs}</span>
        </div>
        <div>
          <span className="metric-label">payment-linked</span>
          <span className="metric-value">{p.payment_linked_jobs}</span>
        </div>
        <div>
          <span className="metric-label">8004 feedback</span>
          <span className="metric-value">{p.feedback_events}</span>
        </div>
      </div>

      <h3 className="drawer-sub">Evidence distribution</h3>
      <div className="dist-bars" aria-label="Evidence distribution">
        {(["high", "medium", "low"] as const).map((k) => (
          <div key={k} className="dist-row">
            <span>{k}</span>
            <div className="score-track">
              <div
                className={`score-fill is-${k}`}
                style={{
                  width: `${Math.min(100, (p.evidence_distribution[k] / Math.max(p.verified_jobs, 1)) * 100)}%`,
                }}
              />
            </div>
            <span>{p.evidence_distribution[k]}</span>
          </div>
        ))}
      </div>

      <h3 className="drawer-sub">Ranking reasons</h3>
      <div className="chip-row">
        {provider.ranking_explanation.map((r) => (
          <span key={r} className="chip chip-reason">
            {r}
          </span>
        ))}
      </div>

      <h3 className="drawer-sub">Recent jobs</h3>
      {provider.sample_jobs.length ? (
        <ul className="job-list">
          {provider.sample_jobs.map((j) => (
            <li key={j.job_id}>
              <span>{j.job_id}</span>
              <span className="muted">{j.outcome ?? "—"}</span>
              {j.tx_hash ? (
                <ExplorerLink value={j.tx_hash} kind="tx" className="mono" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No recent jobs projected for this provider yet.</p>
      )}

      {settlement ? (
        <div className="detail-cta">
          <p className="muted">
            Drill into a settlement that supports this provider score.
          </p>
          <p className="mono muted">
            <ExplorerLink value={settlement.tx_hash} kind="tx" compact={false} />
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={explainBusy}
            onClick={() => onExplain(settlement.tx_hash)}
          >
            {explainBusy ? (
              <Spinner size="sm" label="Explaining" />
            ) : (
              "Explain settlement"
            )}
          </button>
        </div>
      ) : null}

      {provider.authorization_compatibility?.note ? (
        <p className="gap-note">{provider.authorization_compatibility.note}</p>
      ) : null}
    </Modal>
  );
}
