import type { ProviderResult } from "../lib/types";

interface Props {
  providers: ProviderResult[];
  selectedId: string | null;
  onSelect: (provider: ProviderResult) => void;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Compact label when display_name is missing (long agent:wallet / erc8004 ids). */
function providerLabel(p: ProviderResult): string {
  if (p.display_name?.trim()) return p.display_name.trim();
  const id = p.provider_id;
  const wallet = id.match(/^agent:wallet:\d+:(0x[a-fA-F0-9]+)$/);
  if (wallet) {
    const addr = wallet[1]!;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  const erc = id.match(/^agent:erc8004:\d+:(.+)$/);
  if (erc) return `agent #${erc[1]}`;
  if (id.length > 28) return `${id.slice(0, 14)}…${id.slice(-6)}`;
  return id;
}

export function ProviderCards({ providers, selectedId, onSelect }: Props) {
  if (providers.length === 0) {
    return (
      <p className="muted">
        No providers matched. Loosen filters or wait for more matcher projection.
      </p>
    );
  }

  const maxScore = Math.max(...providers.map((p) => p.score), 1);

  return (
    <div className="provider-grid" role="list">
      {providers.map((p, i) => {
        const active = selectedId === p.provider_id;
        const sem = p.semantic_similarity;
        return (
          <button
            key={p.provider_id}
            type="button"
            role="listitem"
            className={`provider-card ${active ? "is-active" : ""}`}
            style={{ animationDelay: `${0.08 + i * 0.08}s` }}
            onClick={() => onSelect(p)}
          >
            <div className="provider-card-top">
              <span className="provider-rank">#{i + 1}</span>
              <span className={`confidence-level is-${p.performance.confidence}`}>
                {p.performance.confidence}
              </span>
            </div>
            <h3
              className="provider-name"
              title={p.display_name ?? p.provider_id}
            >
              {providerLabel(p)}
            </h3>
            <p
              className="provider-caps"
              title={p.capabilities.join(" · ") || undefined}
            >
              {p.capabilities.length
                ? p.capabilities.join(" · ")
                : p.provider_id}
            </p>
            <div className="metric-row">
              <div>
                <span className="metric-label">completion</span>
                <span className="metric-value">
                  {pct(p.performance.completion_rate)}
                </span>
              </div>
              <div>
                <span className="metric-label">jobs</span>
                <span className="metric-value">
                  {p.performance.verified_jobs}
                </span>
              </div>
              <div>
                <span className="metric-label">semantic</span>
                <span className="metric-value">
                  {sem != null ? pct(sem) : "—"}
                </span>
              </div>
            </div>
            <div className="score-track" aria-hidden="true">
              <div
                className="score-fill"
                style={{ width: `${(p.score / maxScore) * 100}%` }}
              />
            </div>
            <div className="chip-row">
              {p.ranking_explanation.slice(0, 3).map((r) => (
                <span key={r} className="chip chip-reason">
                  {r}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
