import { useEffect, useState } from "react";
import { ConfidencePanel } from "./components/ConfidencePanel";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { EvidencePath } from "./components/EvidencePath";
import { VerifyPanel } from "./components/VerifyPanel";
import { DEMO_EXAMPLES } from "./fixtures";
import {
  explainTransaction,
  fetchExamples,
  fetchHealth,
  verifyPayment,
  type DataMode,
} from "./lib/api";
import type {
  AefiEnvelope,
  DemoExample,
  ExplainResult,
  VerifyResult,
} from "./lib/types";

export function App() {
  const [examples, setExamples] = useState<DemoExample[]>(DEMO_EXAMPLES);
  const [hash, setHash] = useState(DEMO_EXAMPLES[0]!.tx_hash);
  const [liveOk, setLiveOk] = useState(false);
  const [preferLive, setPreferLive] = useState(false);
  const [mode, setMode] = useState<DataMode>("fixture");
  const [explain, setExplain] = useState<AefiEnvelope<ExplainResult> | null>(
    null,
  );
  const [verify, setVerify] = useState<AefiEnvelope<VerifyResult> | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void (async () => {
      const [health, list] = await Promise.all([
        fetchHealth(),
        fetchExamples(),
      ]);
      setExamples(list);
      const canLive = health.reachable && health.neo4j === "ok";
      setLiveOk(canLive);
      setPreferLive(canLive);
    })();
  }, []);

  async function runExplain(tx: string) {
    setBusy(true);
    setError(null);
    setVerify(null);
    setSelected(null);
    try {
      const { envelope, mode: m } = await explainTransaction(tx, preferLive);
      setExplain(envelope);
      setMode(m);
      setRevealed(true);
      setSelected(0);
    } catch (e) {
      setExplain(null);
      setError(e instanceof Error ? e.message : "Explain failed");
    } finally {
      setBusy(false);
    }
  }

  async function runVerify() {
    if (!hash) return;
    setVerifyBusy(true);
    setError(null);
    try {
      const { envelope, mode: m } = await verifyPayment(hash, preferLive);
      setVerify(envelope);
      setMode(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  const steps = explain?.result?.steps ?? [];

  return (
    <div className="shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <a className="top-brand" href="https://aefi.io" aria-label="aefi">
          <img src="/brand/aefi-icon.png" alt="" width="36" height="36" />
        </a>
        <span className="top-meta">
          Evidence Studio · hackathon demo
          <span className={`mode-pill is-${mode}`}>{mode}</span>
        </span>
      </header>

      <main>
        <section className={`hero ${revealed ? "is-compact" : ""}`}>
          <h1 className="brand">
            <img
              className="brand-logo"
              src="/brand/aefi-logo.png"
              alt="aefi"
              width="144"
              height="144"
            />
          </h1>
          <p className="tagline">
            Evidence for agent commerce on Arc — explain a settlement as
            structured intelligence.
          </p>

          <form
            className="explain-form"
            onSubmit={(e) => {
              e.preventDefault();
              void runExplain(hash.trim());
            }}
          >
            <label className="sr-only" htmlFor="tx">
              Transaction hash
            </label>
            <input
              id="tx"
              className="tx-input"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Explaining…" : "Explain"}
            </button>
          </form>

          <div className="examples" role="list">
            {examples.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className={`example ${hash === ex.tx_hash ? "is-active" : ""}`}
                role="listitem"
                onClick={() => {
                  setHash(ex.tx_hash);
                  void runExplain(ex.tx_hash);
                }}
              >
                <span className="example-label">{ex.label}</span>
                <span className="example-blurb">{ex.blurb}</span>
              </button>
            ))}
          </div>

          <label className="live-toggle">
            <input
              type="checkbox"
              checked={preferLive}
              disabled={!liveOk}
              onChange={(e) => setPreferLive(e.target.checked)}
            />
            Live Neo4j
            {!liveOk ? <span className="muted"> (API/graph offline)</span> : null}
          </label>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {explain ? (
          <section className="result" aria-live="polite">
            <EvidencePath
              steps={steps}
              selectedIndex={selected}
              onSelect={setSelected}
            />
            <div className="result-grid">
              <ConfidencePanel envelope={explain} />
              <VerifyPanel
                envelope={verify}
                loading={verifyBusy}
                onVerify={() => void runVerify()}
              />
            </div>
            <EvidenceDrawer
              step={selected != null ? steps[selected] ?? null : null}
              evidence={explain.evidence}
              onClose={() => setSelected(null)}
            />
          </section>
        ) : null}
      </main>

      <footer className="footer">
        Agents call aefi over HTTP / MCP · settlement gated by x402 ·{" "}
        <a href="https://aefi.io">aefi.io</a>
      </footer>
    </div>
  );
}
