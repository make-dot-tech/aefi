import { useEffect, useState } from "react";
import { ConfidencePanel } from "./components/ConfidencePanel";
import { ProviderCards } from "./components/ProviderCards";
import { ProviderDetail } from "./components/ProviderDetail";
import { SettlementModal } from "./components/SettlementModal";
import { Spinner } from "./components/Spinner";
import { useToast } from "./components/Toast";
import {
  explainTransaction,
  fetchHealth,
  fetchScenarios,
  searchProviders,
  verifyPayment,
  type DataMode,
} from "./lib/api";
import { SEARCH_SCENARIOS } from "./lib/scenarios";
import type {
  AefiEnvelope,
  DemoScenario,
  ExplainResult,
  ProviderResult,
  ProviderSearchFilters,
  ProviderSearchResult,
  ProviderSortBy,
  VerifyResult,
} from "./lib/types";

const DEFAULT_PAGE_SIZE = 25;

const SORT_OPTIONS: { value: ProviderSortBy; label: string }[] = [
  { value: "score", label: "Relevance" },
  { value: "verified_jobs", label: "Most jobs" },
  { value: "completion_rate", label: "Completion rate" },
  { value: "recent", label: "Most recent" },
];

function withSearchDefaults(
  next: ProviderSearchFilters,
  overrides?: Partial<ProviderSearchFilters>,
): ProviderSearchFilters {
  return {
    sort_by: "score",
    sort_dir: "desc",
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
    ...next,
    ...overrides,
  };
}
export function App() {
  const toast = useToast();
  const [scenarios, setScenarios] = useState<DemoScenario[]>(SEARCH_SCENARIOS);
  const [activeScenario, setActiveScenario] = useState("");
  const [filters, setFilters] = useState<ProviderSearchFilters>(
    withSearchDefaults({ query: "" }),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [liveOk, setLiveOk] = useState(false);
  const [mode, setMode] = useState<DataMode>("offline");
  const [search, setSearch] = useState<AefiEnvelope<ProviderSearchResult> | null>(
    null,
  );
  const [selected, setSelected] = useState<ProviderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
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
        // Navbar pill follows graph connectivity, not whether a search has run.
        setMode(canLive ? "live" : "offline");
        toast.push(
          "info",
          canLive
            ? "Connected to live evidence graph"
            : "API/graph offline — live data unavailable",
        );
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
    opts?: { silent?: boolean },
  ) {
    const request = withSearchDefaults(next, {
      offset: next.offset ?? 0,
      limit: next.limit ?? DEFAULT_PAGE_SIZE,
      sort_by: next.sort_by ?? "score",
      sort_dir: next.sort_dir ?? "desc",
    });
    setFilters(request);
    setBusy(true);
    setExplain(null);
    setVerify(null);
    try {
      const { envelope, mode: m } = await searchProviders(request);
      setSearch(envelope);
      setMode(m);
      setSelected(null);
      const matched = envelope.result?.total_matched ?? envelope.result?.results?.length ?? 0;
      if (!opts?.silent) {
        toast.push(
          "success",
          matched > 0
            ? `Matched ${matched} provider${matched === 1 ? "" : "s"}`
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

  function changeSort(sortBy: ProviderSortBy) {
    const next = withSearchDefaults(filters, {
      sort_by: sortBy,
      sort_dir: "desc",
      offset: 0,
    });
    void runSearch(next);
  }

  function goPage(direction: -1 | 1) {
    const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
    const offset = filters.offset ?? 0;
    const nextOffset = Math.max(0, offset + direction * limit);
    void runSearch(withSearchDefaults(filters, { offset: nextOffset }));
  }

  async function runExplain(tx: string) {
    setExplainHash(tx);
    setVerify(null);
    setStepIdx(null);
    setExplain(null);
    setExplainBusy(true);
    toast.push("info", "Explaining settlement…");
    try {
      const { envelope, mode: m } = await explainTransaction(tx);
      setExplain(envelope);
      setMode(m);
      setStepIdx(0);
      toast.push("success", "Settlement evidence ready");
    } catch (e) {
      setExplain(null);
      setExplainHash(null);
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
      const { envelope, mode: m } = await verifyPayment(explainHash);
      setVerify(envelope);
      setMode(m);
      toast.push(
        envelope.result?.verified ? "success" : "info",
        envelope.result?.verified
          ? "Payment found in evidence graph"
          : "Payment not found in evidence graph",
      );
    } catch (e) {
      toast.push(
        "error",
        e instanceof Error ? e.message : "Lookup failed",
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
          {busy || explainBusy || verifyBusy ? (
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
            <em>natural language</em> — aefi recalls providers from the live
            Arc evidence graph, then re-ranks with job/outcome/settlement
            evidence.
          </p>

          {!liveOk && !booting ? (
            <p className="muted offline-banner">
              Live Neo4j is unavailable. Studio only shows real indexed data —
              check the API / graph connection.
            </p>
          ) : null}

          <form
            className="intent-form"
            onSubmit={(e) => {
              e.preventDefault();
              setShowPresets(false);
              void runSearch(withSearchDefaults(filters, { offset: 0 }));
            }}
          >
            <label className="intent-label" htmlFor="intent">
              Intent
            </label>
            <div className="intent-row">
              <div className="intent-field">
                <input
                  id="intent"
                  className="tx-input intent-input"
                  value={filters.query ?? ""}
                  onChange={(e) => {
                    const q = e.target.value;
                    setActiveScenario("");
                    // Leaving a preset via free-text search must drop its floors
                    // (e.g. completed-jobs min verified), unless advanced filters
                    // are open and the user is deliberately composing both.
                    setFilters((f) =>
                      showAdvanced
                        ? { ...f, query: q, offset: 0 }
                        : withSearchDefaults({
                            query: q,
                            minimum_verified_jobs: 0,
                            minimum_completion_rate: 0,
                            minimum_confidence: "unverified",
                            sort_by: f.sort_by,
                            sort_dir: f.sort_dir,
                            limit: f.limit,
                          }),
                    );
                  }}
                  placeholder="e.g. CCTP cross-chain settlement on Arc"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={busy || !liveOk}
                />
                <div className="preset-wrap">
                  <button
                    type="button"
                    className="btn btn-ghost preset-trigger"
                    disabled={busy || !liveOk || scenarios.length === 0}
                    aria-expanded={showPresets}
                    aria-haspopup="listbox"
                    onClick={() => setShowPresets((v) => !v)}
                  >
                    {activeScenario
                      ? (scenarios.find((s) => s.id === activeScenario)?.label ??
                        "Preset")
                      : "Presets"}
                  </button>
                  {showPresets ? (
                    <ul className="preset-menu" role="listbox">
                      {scenarios.map((s) => (
                        <li key={s.id} role="option" aria-selected={activeScenario === s.id}>
                          <button
                            type="button"
                            className={
                              activeScenario === s.id ? "is-active" : undefined
                            }
                            onClick={() => {
                              setActiveScenario(s.id);
                              const next = withSearchDefaults(s.filters, {
                                sort_by: filters.sort_by,
                                sort_dir: filters.sort_dir,
                                limit: filters.limit,
                                offset: 0,
                              });
                              setShowPresets(false);
                              void runSearch(next);
                            }}
                          >
                            <span className="example-label">{s.label}</span>
                            <span className="example-blurb">{s.blurb}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || !liveOk}
              >
                {busy ? (
                  <Spinner size="sm" label="Searching" />
                ) : (
                  "Search providers"
                )}
              </button>
            </div>
          </form>

          <div className="search-toolbar">
            <label className="sort-control">
              Sort by
              <select
                className="tx-input sort-select"
                value={filters.sort_by ?? "score"}
                disabled={busy || !liveOk}
                onChange={(e) =>
                  changeSort(e.target.value as ProviderSortBy)
                }
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide" : "Show"} structured filters
            </button>
          </div>

          {showAdvanced ? (
            <form
              className="filter-form"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch(withSearchDefaults(filters, { offset: 0 }));
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
              <button
                className="btn btn-ghost"
                type="submit"
                disabled={busy || !liveOk}
              >
                Apply filters
              </button>
            </form>
          ) : null}
        </section>

        {booting || busy ? (
          <div className="loading-panel" aria-busy="true">
            <Spinner
              size="md"
              label={booting ? "Starting studio" : "Searching providers"}
            />
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
            {typeof search.result?.total_matched === "number" &&
            search.result.total_matched > 0 ? (
              <div className="pager">
                <span className="pager-meta">
                  {(() => {
                    const total = search.result.total_matched ?? 0;
                    const offset = search.result.offset ?? 0;
                    const pageLen = results.length;
                    const start = pageLen === 0 ? 0 : offset + 1;
                    const end = offset + pageLen;
                    return `${start}–${end} of ${total}`;
                  })()}
                </span>
                <div className="pager-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || (filters.offset ?? 0) <= 0}
                    onClick={() => goPage(-1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy || !search.result.has_more}
                    onClick={() => goPage(1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {selected ? (
          <ProviderDetail
            provider={selected}
            explainBusy={explainBusy}
            onClose={() => setSelected(null)}
            onExplain={(tx) => {
              void runExplain(tx);
            }}
          />
        ) : null}

        {explainBusy || explain ? (
          <SettlementModal
            loading={explainBusy}
            explainHash={explainHash}
            explain={explain}
            verify={verify}
            verifyBusy={verifyBusy}
            steps={steps}
            stepIdx={stepIdx}
            onSelectStep={setStepIdx}
            onVerify={() => void runVerify()}
            onClose={() => {
              setExplain(null);
              setVerify(null);
              setStepIdx(null);
              setExplainHash(null);
              setExplainBusy(false);
            }}
          />
        ) : null}
      </main>

      <footer className="footer">
        Agents call aefi over HTTP / MCP · pick counterparties with evidence ·
        x402 gated · <a href="https://aefi.io">aefi.io</a>
      </footer>
    </div>
  );
}
