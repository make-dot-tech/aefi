import {
  envelopeFromDisposition,
  gapEnvelope,
  type Fact,
} from "../disposition/composer.js";
import { composeDisposition } from "../disposition/client.js";
import type { AefiEnvelope, EvidenceRef } from "../lib/envelope.js";
import {
  explainTx,
  findAgentActivity,
  findJob,
  findPaymentById,
  findPaymentsByTx,
  type PaymentView,
} from "../graph/queries.js";
import {
  countProviders,
  getProviderPerformance,
  searchProviderPerformance,
  type ProviderSearchFilters,
} from "../graph/providers.js";

function evidenceRefs(rows: Array<Record<string, unknown>>): EvidenceRef[] {
  return rows.map((e) => ({
    evidence_id: String(e.id ?? e.reference ?? "unknown"),
    type: String(e.type ?? "unknown"),
    source: String(e.source ?? "neo4j"),
    reference: String(e.reference ?? e.id ?? ""),
    supports: Array.isArray(e.claims) ? e.claims.map(String) : undefined,
  }));
}

function factsFromPayment(view: PaymentView): Fact[] {
  const facts: Fact[] = [];
  const payId = String(view.payment.id);
  if (view.transfer) {
    facts.push({
      code: "payment_only_observed",
      present: true,
      strength: "exact",
      refs: [payId, String(view.transfer.id)],
    });
  }
  for (const m of view.memos) {
    facts.push({
      code: "exact_job_id_memo",
      present: view.jobs.length > 0,
      strength: "exact",
      refs: [payId, String(m.id), ...view.jobs.map((j) => String(j.id))],
    });
  }
  for (const j of view.jobs) {
    facts.push({
      code: "job_contract_reference",
      present: true,
      strength: "strong",
      refs: [payId, String(j.id)],
    });
  }
  return facts;
}

function paymentSummary(view: PaymentView): string {
  const amount = view.payment.amount ?? view.transfer?.value ?? "?";
  const from = view.fromWallet?.address ?? "?";
  const to = view.toWallet?.address ?? "?";
  const asset = view.payment.asset ?? "USDC";
  const jobBit =
    view.jobs.length > 0
      ? ` Linked job(s): ${view.jobs.map((j) => j.job_id ?? j.id).join(", ")}.`
      : "";
  const memoBit = view.memos.length > 0 ? ` Annotated by ${view.memos.length} memo(s).` : "";
  return `${asset} payment settled: ${amount} from ${from} to ${to}.${memoBit}${jobBit}`;
}

export async function verifyPayment(input: {
  tx_hash?: string;
  payment_id?: string;
  transfer_ref?: string;
}): Promise<AefiEnvelope> {
  let views: PaymentView[] = [];
  if (input.payment_id) {
    const one = await findPaymentById(input.payment_id);
    if (one) views = [one];
  } else if (input.tx_hash) {
    views = await findPaymentsByTx(input.tx_hash);
  } else if (input.transfer_ref) {
    // transfer_ref may be xfer:… or evt:… — try payment id derived patterns via tx lookup fallback
    const asPay = input.transfer_ref.replace(/^xfer:/, "pay:").replace(/^evt:/, "pay:");
    const one = await findPaymentById(asPay);
    if (one) views = [one];
  }

  if (views.length === 0) {
    const subject =
      input.tx_hash ?? input.payment_id ?? input.transfer_ref ?? "unknown";
    return envelopeFromDisposition(
      `No settled payment found in evidence graph for ${subject}.`,
      { verified: false, subject, payments: [] },
      await composeDisposition({
        schema_version: "0.1.0",
        subject: { type: "payment", id: subject },
        facts: [],
        evidence_types: [],
        coverage: {
          status: "unknown",
          known_gaps: ["payment_not_in_graph", "authorization_evidence_missing"],
        },
      }),
      {
        status: "unknown",
        known_gaps: ["payment_not_in_graph", "authorization_evidence_missing"],
      },
    );
  }

  const primary = views[0]!;
  const facts = views.flatMap(factsFromPayment);
  const evidence = evidenceRefs(views.flatMap((v) => v.evidence));
  const knownGaps = [
    "authorization_evidence_missing",
    ...(views.every((v) => v.jobs.length === 0) ? ["job_link_missing"] : []),
    ...(views.every((v) => v.memos.length === 0) ? ["memo_missing"] : []),
  ];
  const coverage = {
    status: (views.some((v) => v.jobs.length) ? "partial" : "minimal") as
      | "partial"
      | "minimal",
    known_gaps: knownGaps,
  };
  const disposition = await composeDisposition({
    schema_version: "0.1.0",
    subject: { type: "payment", id: String(primary.payment.id) },
    facts,
    evidence_types: [...new Set(evidence.map((e) => e.type))],
    coverage,
  });

  return {
    ...envelopeFromDisposition(
      views.length === 1
        ? paymentSummary(primary)
        : `Verified ${views.length} settled payments for tx ${primary.payment.tx_hash}.`,
      {
        verified: true,
        payments: views.map((v) => ({
          payment_id: v.payment.id,
          tx_hash: v.payment.tx_hash,
          amount: v.payment.amount,
          asset: v.payment.asset,
          from: v.fromWallet?.address ?? null,
          to: v.toWallet?.address ?? null,
          transfer_id: v.transfer?.id ?? null,
          memo_ids: v.memos.map((m) => m.id),
          job_ids: v.jobs.map((j) => j.id),
        })),
      },
      disposition,
      coverage,
      evidence,
    ),
    graph_refs: {
      node_ids: [
        ...views.map((v) => String(v.payment.id)),
        ...views.flatMap((v) => (v.transfer ? [String(v.transfer.id)] : [])),
      ],
    },
  };
}

export async function explainTransaction(hash: string): Promise<AefiEnvelope> {
  const view = await explainTx(hash);
  if (
    view.payments.length === 0 &&
    view.transfers.length === 0 &&
    view.memos.length === 0 &&
    view.jobs.length === 0
  ) {
    return envelopeFromDisposition(
      `No indexed evidence for transaction ${hash}.`,
      { tx_hash: hash.toLowerCase(), steps: [] },
      await composeDisposition({
        schema_version: "0.1.0",
        subject: { type: "transaction", id: hash },
        facts: [],
        evidence_types: [],
        coverage: { status: "unknown", known_gaps: ["tx_not_in_graph"] },
      }),
      { status: "unknown", known_gaps: ["tx_not_in_graph"] },
    );
  }

  const facts = view.payments.flatMap(factsFromPayment);
  const evidence = evidenceRefs(view.payments.flatMap((p) => p.evidence));
  const steps = [
    ...view.transfers.map((t) => ({
      step: "settlement",
      transfer_id: t.id,
      from: t.from,
      to: t.to,
      value: t.value,
    })),
    ...view.memos.map((m) => ({
      step: "memo",
      memo_id: m.memo_id ?? m.id,
      sender: m.sender,
    })),
    ...view.payments.map((p) => ({
      step: "payment",
      payment_id: p.payment.id,
      from: p.fromWallet?.address,
      to: p.toWallet?.address,
      amount: p.payment.amount,
    })),
    ...view.jobs.map((j) => ({
      step: "job",
      job_id: j.job_id ?? j.id,
    })),
  ];

  const coverage = {
    status: "partial" as const,
    known_gaps: [
      "authorization_evidence_missing",
      ...(view.payments.every((p) => p.jobs.length === 0) ? ["job_link_missing"] : []),
    ],
  };

  const disposition = await composeDisposition({
    schema_version: "0.1.0",
    subject: { type: "transaction", id: hash.toLowerCase() },
    facts,
    evidence_types: [...new Set(evidence.map((e) => e.type))],
    coverage,
  });

  return {
    ...envelopeFromDisposition(
      `Transaction ${hash.toLowerCase()}: ${view.payments.length} payment(s), ${view.transfers.length} transfer(s), ${view.memos.length} memo(s).`,
      { tx_hash: hash.toLowerCase(), steps, payments: view.payments.map((p) => p.payment) },
      disposition,
      coverage,
      evidence,
    ),
    graph_refs: {
      node_ids: [
        ...view.payments.map((p) => String(p.payment.id)),
        ...view.transfers.map((t) => String(t.id)),
      ],
    },
  };
}

export async function lookupJob(jobId: string): Promise<AefiEnvelope> {
  const view = await findJob(jobId);
  if (!view) {
    return envelopeFromDisposition(
      `Job ${jobId} not found in evidence graph.`,
      { job_id: jobId },
      await composeDisposition({
        schema_version: "0.1.0",
        subject: { type: "job", id: jobId },
        facts: [],
        evidence_types: [],
        coverage: { status: "unknown", known_gaps: ["job_not_in_graph"] },
      }),
      { status: "unknown", known_gaps: ["job_not_in_graph"] },
    );
  }

  const facts: Fact[] = [
    {
      code: "erc_8183_job_lifecycle",
      present: true,
      strength: "exact",
      refs: [String(view.job.id)],
    },
  ];
  if (view.outcomes.some((o) => o.kind === "JobCompleted")) {
    facts.push({
      code: "escrow_release_after_acceptance",
      present: true,
      strength: "strong",
      refs: view.outcomes.map((o) => String(o.id)),
    });
  }

  const evidence = evidenceRefs(view.evidence);
  const coverage = {
    status: "partial" as const,
    known_gaps: [
      "authorization_evidence_missing",
      ...(view.payments.length === 0 ? ["payment_link_missing"] : []),
    ],
  };
  const disposition = await composeDisposition({
    schema_version: "0.1.0",
    subject: { type: "job", id: String(view.job.id) },
    facts,
    evidence_types: [...new Set(evidence.map((e) => e.type))],
    coverage,
  });

  return {
    ...envelopeFromDisposition(
      `Job ${view.job.job_id ?? view.job.id} (last_event=${view.job.last_event ?? "unknown"}).`,
      {
        job: view.job,
        parties: {
          requesters: view.requesters,
          providers: view.providers,
          evaluators: view.evaluators,
        },
        outcomes: view.outcomes,
        payments: view.payments,
      },
      disposition,
      coverage,
      evidence,
    ),
    graph_refs: { node_ids: [String(view.job.id)] },
  };
}

export async function getAgentActivity(id: string): Promise<AefiEnvelope> {
  const view = await findAgentActivity(id);
  if (!view.agent && !view.wallet && view.items.length === 0) {
    return envelopeFromDisposition(
      `No agent/wallet activity found for ${id}.`,
      { agent_id: id, items: [] },
      await composeDisposition({
        schema_version: "0.1.0",
        subject: { type: "agent", id },
        facts: [],
        evidence_types: [],
        coverage: { status: "unknown", known_gaps: ["agent_not_in_graph"] },
      }),
      { status: "unknown", known_gaps: ["agent_not_in_graph"] },
    );
  }

  const facts: Fact[] = [];
  if (view.agent?.identity_source === "erc_8004" || String(view.agent?.id ?? "").includes("erc8004")) {
    facts.push({
      code: "erc_8004_identity_match",
      present: true,
      strength: "exact",
      refs: [String(view.agent!.id)],
    });
  }
  if (view.items.some((i) => i.kind === "evidence" && i.props.event_kind === "NewFeedback")) {
    facts.push({
      code: "erc_8004_reputation_event",
      present: true,
      strength: "strong",
      refs: view.items.filter((i) => i.kind === "evidence").map((i) => i.id),
    });
  }
  if (view.items.some((i) => i.kind === "payment")) {
    facts.push({
      code: "payment_only_observed",
      present: true,
      strength: "exact",
      refs: view.items.filter((i) => i.kind === "payment").map((i) => i.id),
    });
  }

  const coverage = {
    status: "minimal" as const,
    known_gaps: ["partial_wave_a", "authorization_evidence_missing"],
  };
  const disposition = await composeDisposition({
    schema_version: "0.1.0",
    subject: { type: "agent", id },
    facts,
    evidence_types: [],
    coverage,
  });

  return {
    ...envelopeFromDisposition(
      `Activity for ${view.agent?.id ?? view.wallet?.address ?? id}: ${view.items.length} item(s).`,
      {
        agent: view.agent,
        wallet: view.wallet,
        items: view.items,
      },
      disposition,
      coverage,
      [],
    ),
    graph_refs: {
      node_ids: [
        ...(view.agent ? [String(view.agent.id)] : []),
        ...(view.wallet ? [String(view.wallet.id)] : []),
      ],
    },
  };
}

export function checkAuthority(_body: unknown): AefiEnvelope {
  return gapEnvelope(
    "Authority check is registered but mandate/task evidence adapters are not wired yet.",
    ["mandate_adapter_missing", "task_authority_adapter_missing"],
    ["authorization_evidence_missing"],
  );
}

export function traceTask(taskExecutionId: string): AefiEnvelope {
  return gapEnvelope(
    `Task trace for ${taskExecutionId} unavailable until task adapters exist.`,
    ["task_adapter_missing", `task_execution_id=${taskExecutionId}`],
    ["authorization_evidence_missing"],
  );
}

function parseSearchFilters(body: unknown): ProviderSearchFilters {
  const b = (body ?? {}) as Record<string, unknown>;
  const conf = b.minimum_confidence;
  return {
    query: typeof b.query === "string" ? b.query : undefined,
    capability: typeof b.capability === "string" ? b.capability : undefined,
    minimum_verified_jobs:
      typeof b.minimum_verified_jobs === "number"
        ? b.minimum_verified_jobs
        : typeof b.minimum_verified_jobs === "string"
          ? Number(b.minimum_verified_jobs)
          : undefined,
    minimum_completion_rate:
      typeof b.minimum_completion_rate === "number"
        ? b.minimum_completion_rate
        : typeof b.minimum_completion_rate === "string"
          ? Number(b.minimum_completion_rate)
          : undefined,
    minimum_confidence:
      conf === "high" || conf === "medium" || conf === "low" || conf === "unverified"
        ? conf
        : undefined,
    limit: typeof b.limit === "number" ? b.limit : undefined,
    semantic_top_k:
      typeof b.semantic_top_k === "number" ? b.semantic_top_k : undefined,
  };
}

export async function searchProviders(body: unknown = {}): Promise<AefiEnvelope> {
  const filters = parseSearchFilters(body);
  let providers;
  try {
    providers = await searchProviderPerformance(filters);
  } catch {
    return gapEnvelope(
      "Provider search unavailable — Neo4j evidence graph is unreachable.",
      ["neo4j_unavailable", "provider_performance_graph_empty"],
      ["insufficient_evidence"],
    );
  }

  const total = await countProviders().catch(() => 0);
  if (providers.length === 0) {
    return envelopeFromDisposition(
      total === 0
        ? "No provider job history in the evidence graph yet. Wait for the matcher to project ERC-8183 activity from Postgres."
        : "No providers matched the structured filters.",
      {
        interpreted_filters: filters,
        results: [],
        graph_provider_count: total,
      },
      await composeDisposition({
        schema_version: "0.1.0",
        subject: { type: "provider", id: "search" },
        facts: [],
        evidence_types: [],
        coverage: {
          status: "unknown",
          known_gaps:
            total === 0
              ? ["provider_performance_graph_empty"]
              : ["no_providers_matched_filters"],
        },
      }),
      {
        status: "unknown",
        known_gaps:
          total === 0
            ? ["provider_performance_graph_empty"]
            : ["no_providers_matched_filters"],
      },
    );
  }

  const top = providers[0]!;
  const facts: Fact[] = [
    {
      code: "provider_performance_aggregated",
      present: true,
      strength: "strong",
      refs: providers.map((p) => p.provider_id),
    },
    {
      code: "job_outcome_history_observed",
      present: providers.some((p) => p.performance.verified_jobs > 0),
      strength: "exact",
      refs: providers.map((p) => p.provider_id),
    },
    {
      code: "capability_semantic_match",
      present: providers.some(
        (p) => (p.semantic_similarity ?? 0) >= 0.35,
      ),
      strength: "medium",
      refs: providers
        .filter((p) => (p.semantic_similarity ?? 0) >= 0.35)
        .map((p) => p.provider_id),
    },
  ];

  const disposition = await composeDisposition({
    schema_version: "0.1.0",
    subject: { type: "provider", id: "search" },
    facts,
    evidence_types: ["job_event", "transfer", "reputation_event"],
    coverage: {
      status: "partial",
      known_gaps: ["authorization_evidence_missing"],
    },
  });

  const queryBit = filters.query
    ? ` Intent: “${filters.query}”.`
    : "";

  return {
    ...envelopeFromDisposition(
      `Found ${providers.length} provider(s). Top match: ${top.display_name ?? top.provider_id} (${(top.performance.completion_rate * 100).toFixed(1)}% completion across ${top.performance.verified_jobs} jobs).${queryBit}`,
      {
        interpreted_filters: {
          ...filters,
          semantic_top_k: filters.semantic_top_k ?? (filters.query ? 25 : undefined),
        },
        results: providers.map((p) => ({
          provider_id: p.provider_id,
          display_name: p.display_name,
          wallet: p.wallet,
          capabilities: p.capabilities,
          performance: p.performance,
          ranking_explanation: p.ranking_explanation,
          score: p.score,
          graph_score: p.graph_score,
          semantic_similarity: p.semantic_similarity,
          sample_jobs: p.sample_jobs,
          sample_settlements: p.sample_settlements,
          authorization_compatibility: {
            service_allowed: null,
            estimated_price_within_limit: null,
            note: "Mandate/task adapters not wired — authorization_evidence_missing.",
          },
        })),
        graph_provider_count: total,
      },
      disposition,
      {
        status: "partial",
        known_gaps: ["authorization_evidence_missing"],
      },
      providers.flatMap((p) =>
        p.sample_settlements.slice(0, 1).map((s) => ({
          evidence_id: `ev:search:${p.provider_id}`,
          type: "provider_performance",
          source: "neo4j",
          reference: s.tx_hash || p.provider_id,
          supports: [p.provider_id],
        })),
      ),
    ),
    graph_refs: { node_ids: providers.map((p) => p.provider_id) },
  };
}

export async function getProvider(providerId: string): Promise<AefiEnvelope> {
  let view;
  try {
    view = await getProviderPerformance(providerId);
  } catch {
    return gapEnvelope(
      `Provider ${providerId} unavailable — Neo4j unreachable.`,
      ["neo4j_unavailable"],
      ["insufficient_evidence"],
    );
  }

  if (!view) {
    return envelopeFromDisposition(
      `No provider performance found for ${providerId}.`,
      { provider_id: providerId, found: false },
      await composeDisposition({
        schema_version: "0.1.0",
        subject: { type: "provider", id: providerId },
        facts: [],
        evidence_types: [],
        coverage: { status: "unknown", known_gaps: ["provider_not_in_graph"] },
      }),
      { status: "unknown", known_gaps: ["provider_not_in_graph"] },
    );
  }

  const disposition = await composeDisposition({
    schema_version: "0.1.0",
    subject: { type: "provider", id: view.provider_id },
    facts: [
      {
        code: "provider_performance_aggregated",
        present: true,
        strength: "strong",
        refs: [view.provider_id],
      },
      {
        code: "job_outcome_history_observed",
        present: view.performance.verified_jobs > 0,
        strength: "exact",
        refs: [view.provider_id],
      },
    ],
    evidence_types: ["job_event", "transfer", "reputation_event"],
    coverage: {
      status: "partial",
      known_gaps: ["authorization_evidence_missing"],
    },
  });

  return {
    ...envelopeFromDisposition(
      `${view.display_name ?? view.provider_id}: ${view.performance.verified_jobs} verified jobs, ${(view.performance.completion_rate * 100).toFixed(1)}% completion, confidence ${view.performance.confidence}.`,
      { found: true, ...view },
      disposition,
      {
        status: "partial",
        known_gaps: ["authorization_evidence_missing"],
      },
    ),
    graph_refs: { node_ids: [view.provider_id] },
  };
}
