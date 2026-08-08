import { useEffect, useState } from "react";
import { ConfidencePanel } from "./components/ConfidencePanel";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { EvidencePath } from "./components/EvidencePath";
import { ProviderCards } from "./components/ProviderCards";
import { ProviderDetail } from "./components/ProviderDetail";
import { Spinner } from "./components/Spinner";
import { useToast } from "./components/Toast";
import { VerifyPanel } from "./components/VerifyPanel";
import {
  explainTransaction,
  fetchHealth,
  fetchScenarios,
  searchProviders,
  seedDemo,
  verifyPayment,
  type DataMode,
} from "./lib/api";
import { DEMO_SCENARIOS } from "./fixtures/providers";
import type {
  AefiEnvelope,
  DemoScenario,
  ExplainResult,
  ProviderResult,
  ProviderSearchFilters,
  ProviderSearchResult,
  VerifyResult,
} from "./lib/types";

export function App() {
  const toast = useToast();
  const [scenarios, setScenarios] = useState<DemoScenario[]>(DEMO_SCENARIOS);
  const [activeScenario, setActiveScenario] = useState<string>(
    DEMO_SCENARIOS[0]!.id,
  );
  const [filters, setFilters] = useState<ProviderSearchFilters>(
    DEMO_SCENARIOS[0]!.filters,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [liveOk, setLiveOk] = useState(false);
  const [preferLive, setPreferLive] = useState(false);
  const [mode, setMode] = useState<DataMode>("fixture");
  const [search, setSearch] = useState<AefiEnvelope<ProviderSearchResult> | null>(
    null,
  );
  const [selected, setSelected] = useState<ProviderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [seedBusy, setSeedBusy] = useState(false);
  const [explainBusy, setExplainBusy] = useState(false);

  const [explain, setExplain] = useState<AefiEnvelope<ExplainResult> | null>(
    null,
  );
  const [verify, setVerify] = useState<AefiEnvelope<VerifyResult> | null>(null);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [explainHash, setExplainHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [health, list] = await Promise.all([
          fetchHealth(),
          fetchScenarios(),
        ]);
        if (cancelled) return;
        setScenarios(list);
        const canLive = health.reachable && health.neo4j === "ok";
        setLiveOk(canLive);
        setPreferLive(canLive);
        toast.push(
          "info",
          canLive ? "Live Neo4j connected" : "Using fixtures — API/graph offline",
        );
        const first = list[0];
        if (first) {
          setActiveScenario(first.id);
          setFilters(first.filters);
          await runSearch(first.filters, canLive, { silent: true });
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(
    next: ProviderSearchFilters,
    live = preferLive,
    opts?: { silent?: boolean },
  ) {
    setBusy(true);
    setExplain(null);
    setVerify(null);
    try {
      const { envelope, mode: m } = await searchProviders(next, live);
      setSearch(envelope);
      setMode(m);
      const top = envelope.result?.results?.[0] ?? null;
      setSelected(top);
      const n = envelope.result?.results?.length ?? 0;
      if (!opts?.silent) {
        toast.push(
          "success",
          n > 0
            ? `Found ${n} provider${n === 1 ? "" : "s"} · ${m}`
            : "No providers matched filters",
        );
      }
    } catch (e) {
      setSearch(null);
      toast.push(
        "error",
        e instanceof Error ? e.message : "Search failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runExplain(tx: string) {
    setExplainHash(tx);
    setVerify(null);
    setStepIdx(null);
    setExplainBusy(true);
    toast.push("info", "Explaining settlement…");
    try {
      const { envelope, mode: m } = await explainTransaction(tx, preferLive);
      setExplain(envelope);
      setMode(m);
      setStepIdx(0);
      toast.push("success", "Settlement evidence ready");
      requestAnimationFrame(() => {
        document
          .querySelector(".explain-block")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setExplain(null);
      toast.push(
        "error",
        e instanceof Error ? e.message : "Explain failed",
      );
    } finally {
      setExplainBusy(false);
    }
  }

  async function runVerify() {
    if (!explainHash) return;
    setVerifyBusy(true);
    try {
      const { envelope, mode: m } = await verifyPayment(explainHash, preferLive);
      setVerify(envelope);
      setMode(m);
      toast.push(
        envelope.result?.verified ? "success" : "info",
        envelope.result?.verified
          ? "Payment verified against evidence graph"
          : "Payment not verified",
      );
    } catch (e) {
      toast.push(
        "error",
        e instanceof Error ? e.message : "Verify failed",
      );
    } finally {
      setVerifyBusy(false);
    }
  }

  const results = search?.result?.results ?? [];
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
          Evidence Studio · counterparty intelligence
          <span className={`mode-pill is-${mode}`}>{mode}</span>
          {busy || seedBusy || explainBusy || verifyBusy ? (
            <Spinner size="sm" label="working" />
          ) : null}
        </span>
      </header>

      <main>
        <section className="hero is-compact">
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
            A seeking agent describes what it needs in{" "}
            <em>natural language</em> — aefi recalls providers semantically,
            then re-ranks with job/outcome/settlement evidence.
          </p>

          <div className="scenarios" role="list">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                role="listitem"
                className={`example ${activeScenario === s.id ? "is-active" : ""}`}
                disabled={busy}
                onClick={() => {
                  setActiveScenario(s.id);
                  setFilters(s.filters);
                  void runSearch(s.filters);
                }}
              >
                <span className="example-label">{s.label}</span>
                <span className="example-blurb">{s.blurb}</span>
              </button>
            ))}
          </div>

          <form
            className="intent-form"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(filters);
            }}
          >
            <label className="intent-label" htmlFor="intent">
              Intent
            </label>
            <div className="intent-row">
              <input
                id="intent"
                className="tx-input intent-input"
                value={filters.query ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, query: e.target.value }))
                }
                placeholder="e.g. reliable on-chain price feeds for trading agents"
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
              />
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? (
                  <Spinner size="sm" label="Searching" />
                ) : (
                  "Search providers"
                )}
              </button>
            </div>
          </form>

          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"} structured filters
          </button>

          {showAdvanced ? (
            <form
              className="filter-form"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch(filters);
              }}
            >
              <label>
                capability tag
                <input
                  className="tx-input"
                  value={filters.capability ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      capability: e.target.value || undefined,
                    }))
                  }
                  placeholder="optional exact tag"
                />
              </label>
              <label>
                min jobs
                <input
                  className="tx-input"
                  type="number"
                  min={0}
                  value={filters.minimum_verified_jobs ?? 0}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      minimum_verified_jobs: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                min completion
                <input
                  className="tx-input"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={filters.minimum_completion_rate ?? 0}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      minimum_completion_rate: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <button className="btn btn-ghost" type="submit" disabled={busy}>
                Apply filters
              </button>
            </form>
          ) : null}

          <div className="toolbar">
            <label className="live-toggle">
              <input
                type="checkbox"
                checked={preferLive}
                disabled={!liveOk}
                onChange={(e) => {
                  setPreferLive(e.target.checked);
                  toast.push(
                    "info",
                    e.target.checked
                      ? "Live Neo4j preferred"
                      : "Fixture mode preferred",
                  );
                }}
              />
              Live Neo4j
              {!liveOk ? (
                <span className="muted"> (API/graph offline)</span>
              ) : null}
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!liveOk || seedBusy || busy}
              onClick={() => {
                void (async () => {
                  setSeedBusy(true);
                  toast.push("info", "Seeding demo graph + embeddings…");
                  const r = await seedDemo();
                  setSeedBusy(false);
                  if (r.ok) {
                    toast.push("success", r.detail);
                    setPreferLive(true);
                    await runSearch(filters, true);
                  } else {
                    toast.push("error", r.detail);
                  }
                })();
              }}
            >
              {seedBusy ? (
                <Spinner size="sm" label="Seeding" />
              ) : (
                "Seed demo graph"
              )}
            </button>
          </div>
        </section>

        {booting || busy ? (
          <div className="loading-panel" aria-busy="true">
            <Spinner size="md" label={booting ? "Starting studio" : "Searching providers"} />
            <div className="skeleton-grid" aria-hidden="true">
              <div className="skeleton-card" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          </div>
        ) : null}

        {search && !busy ? (
          <section className="result" aria-live="polite">
            <ConfidencePanel envelope={search} />
            <ProviderCards
              providers={results}
              selectedId={selected?.provider_id ?? null}
              onSelect={setSelected}
            />
            {selected ? (
              <ProviderDetail
                provider={selected}
                explainBusy={explainBusy}
                onClose={() => setSelected(null)}
                onExplain={(tx) => void runExplain(tx)}
              />
            ) : null}
          </section>
        ) : null}

        {explainBusy && !explain ? (
          <div className="loading-panel explain-loading">
            <Spinner size="md" label="Loading settlement evidence" />
          </div>
        ) : null}

        {explain ? (
          <section className="result explain-block" aria-live="polite">
            <h2 className="section-title">Settlement evidence</h2>
            <p className="mono muted">{explainHash}</p>
            <EvidencePath
              steps={steps}
              selectedIndex={stepIdx}
              onSelect={setStepIdx}
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
              step={stepIdx != null ? steps[stepIdx] ?? null : null}
              evidence={explain.evidence}
              onClose={() => setStepIdx(null)}
            />
          </section>
        ) : null}
      </main>

      <footer className="footer">
        Agents call aefi over HTTP / MCP · pick counterparties with evidence ·
        x402 gated · <a href="https://aefi.io">aefi.io</a>
      </footer>
    </div>
  );
}
