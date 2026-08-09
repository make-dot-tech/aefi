import { useState, type ReactNode } from "react";
import type { ProviderResult } from "../lib/types";
import { formatAssetAmount } from "../lib/money";
import { providerLabel, shortProviderId } from "../lib/labels";
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

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="agent-meta-cell">
      <span className="agent-meta-label">{label}</span>
      <div className="agent-meta-value">{children}</div>
    </div>
  );
}

function HexOrDash({
  value,
  kind,
  chainId,
}: {
  value: string | null | undefined;
  kind: "address" | "tx";
  chainId?: string | null;
}) {
  if (!value) return <span className="muted">—</span>;
  return (
    <ExplorerLink
      value={value}
      kind={kind}
      chainId={chainId}
      compact
      className="mono"
    />
  );
}

export function ProviderDetail({
  provider,
  onExplain,
  onClose,
  explainBusy = false,
}: Props) {
  const p = provider.performance;
  const settlement = provider.sample_settlements[0];
  const title = providerLabel(provider);
  const id = provider.identity;
  const chainId = id?.chain_id ?? null;
  const [identityOpen, setIdentityOpen] = useState(false);
  const hasIdentityCard =
    Boolean(provider.blurb) || provider.capabilities.length > 0;

  const agentNum = id?.agent_id ?? shortProviderId(provider.provider_id);
  const status = id?.status ?? "unconfigured";

  return (
    <Modal
      title={title}
      titleFull={provider.display_name ?? provider.provider_id}
      onClose={onClose}
      size="md"
      subtitle={
        <div className="agent-header-meta">
          <span className="provider-id mono" title={provider.provider_id}>
            agent #{agentNum}
          </span>
          <span className={`agent-status is-${status}`}>{status}</span>
          {id?.network ? (
            <span className="agent-network-badge">{id.network}</span>
          ) : null}
        </div>
      }
    >
      <div className="agent-meta-grid" aria-label="Agent registry details">
        <MetaCell label="Agent ID">{agentNum}</MetaCell>
        <MetaCell label="Network">{id?.network ?? "—"}</MetaCell>
        <MetaCell label="Owner">
          <HexOrDash value={id?.owner} kind="address" chainId={chainId} />
        </MetaCell>
        <MetaCell label="Agent wallet">
          <HexOrDash
            value={provider.wallet}
            kind="address"
            chainId={chainId}
          />
        </MetaCell>
        <MetaCell label="Creator">
          <HexOrDash value={id?.creator} kind="address" chainId={chainId} />
        </MetaCell>
        <MetaCell label="Created tx">
          <HexOrDash
            value={id?.registered_tx}
            kind="tx"
            chainId={chainId}
          />
        </MetaCell>
        <MetaCell label="Registry">
          <HexOrDash value={id?.registry} kind="address" chainId={chainId} />
        </MetaCell>
        <MetaCell label="Last event">{id?.last_event ?? "—"}</MetaCell>
        <MetaCell label="Last activity tx">
          <HexOrDash value={id?.last_tx} kind="tx" chainId={chainId} />
        </MetaCell>
        <MetaCell label="Registration block">
          {id?.registered_block != null
            ? id.registered_block.toLocaleString()
            : "—"}
        </MetaCell>
      </div>

      {hasIdentityCard ? (
        <section className="identity-block" aria-label="Registered identity">
          <button
            type="button"
            className="identity-toggle"
            aria-expanded={identityOpen}
            onClick={() => setIdentityOpen((v) => !v)}
          >
            <span>Registered identity</span>
            <span className="identity-toggle-hint">
              {identityOpen ? "Hide" : "Show"}
              {provider.capabilities.length
                ? ` · ${provider.capabilities.length} skills`
                : ""}
            </span>
          </button>
          {identityOpen ? (
            <div className="identity-body">
              {provider.blurb ? (
                <p className="identity-blurb">{provider.blurb}</p>
              ) : null}
              {provider.capabilities.length ? (
                <div className="chip-row" aria-label="Skills">
                  {provider.capabilities.map((c) => (
                    <span key={c} className="chip chip-skill">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No skills published on this agent card.</p>
              )}
            </div>
          ) : null}
        </section>
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
          <p className="mono muted truncate-line">
            <ExplorerLink value={settlement.tx_hash} kind="tx" />
          </p>
          {settlement.amount ? (
            <p className="muted">
              {formatAssetAmount(settlement.amount, {
                asset: settlement.asset ?? "USDC",
                decimals: settlement.decimals,
              })}
            </p>
          ) : null}
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
