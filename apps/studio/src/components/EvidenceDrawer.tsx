import type { EvidenceRef, ExplainStep } from "../lib/types";
import { looksLikeAddress, looksLikeTxHash } from "../lib/explorer";
import { ExplorerLink } from "./ExplorerLink";

interface Props {
  step: ExplainStep | null;
  evidence: EvidenceRef[];
  onClose: () => void;
}

function stepEvidence(
  step: ExplainStep | null,
  evidence: EvidenceRef[],
): EvidenceRef[] {
  if (!step) return [];
  const keys = [
    step.payment_id,
    step.transfer_id,
    step.memo_id,
    step.job_id,
  ].filter(Boolean) as string[];
  if (keys.length === 0) return evidence.slice(0, 2);
  const matched = evidence.filter(
    (e) =>
      keys.some((k) => e.reference.includes(k) || e.evidence_id.includes(k)) ||
      e.supports?.some((s) => keys.some((k) => s.includes(k))),
  );
  return matched.length ? matched : evidence.slice(0, 1);
}

function FactValue({ name, value }: { name: string; value: string }) {
  const key = name.toLowerCase();
  if (key.includes("tx") || key === "tx_hash" || looksLikeTxHash(value)) {
    return <ExplorerLink value={value} kind="tx" compact={false} />;
  }
  if (
    key === "from" ||
    key === "to" ||
    key === "sender" ||
    key.includes("addr") ||
    key.includes("wallet") ||
    looksLikeAddress(value)
  ) {
    return <ExplorerLink value={value} kind="address" compact={false} />;
  }
  return <>{value}</>;
}

export function EvidenceDrawer({ step, evidence, onClose }: Props) {
  if (!step) return null;
  const rows = stepEvidence(step, evidence);

  return (
    <aside className="drawer" aria-label="Evidence detail">
      <div className="drawer-head">
        <h2>{step.step}</h2>
        <button type="button" className="drawer-close" onClick={onClose}>
          close
        </button>
      </div>
      <dl className="drawer-facts">
        {Object.entries(step)
          .filter(([k, v]) => k !== "step" && v != null && v !== "")
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <FactValue name={k} value={String(v)} />
              </dd>
            </div>
          ))}
      </dl>
      <h3 className="drawer-sub">Linked evidence</h3>
      <ul className="drawer-evidence">
        {rows.map((e) => (
          <li key={e.evidence_id}>
            <span className="ev-type">{e.type}</span>
            <span className="ev-source">{e.source}</span>
            <code className="ev-ref">
              {looksLikeTxHash(e.reference) || looksLikeAddress(e.reference) ? (
                <ExplorerLink
                  value={e.reference}
                  kind={looksLikeTxHash(e.reference) ? "tx" : "address"}
                  compact={false}
                />
              ) : (
                e.reference
              )}
            </code>
          </li>
        ))}
        {rows.length === 0 ? <li className="muted">No evidence refs.</li> : null}
      </ul>
    </aside>
  );
}
