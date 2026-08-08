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

export function searchProviders(_body: unknown): AefiEnvelope {
  return gapEnvelope(
    "Provider search is registered but reputation/job history graph is empty.",
    ["provider_performance_graph_empty"],
    ["insufficient_evidence"],
  );
}
