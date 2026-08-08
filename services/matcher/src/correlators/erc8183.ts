import {
  emptyBatch,
  ids,
  type Erc8183Row,
  type ProjectionBatch,
} from "../types.js";

const TERMINAL = new Set(["JobCompleted", "JobRejected", "JobExpired"]);

export function correlateErc8183(rows: Erc8183Row[]): ProjectionBatch {
  const batch = emptyBatch();

  for (const row of rows) {
    const jobNodeId = ids.job(row.chain_id, row.job_id);
    const payload = row.payload ?? {};

    batch.nodes.push({
      label: "Job",
      id: jobNodeId,
      props: {
        chain_id: row.chain_id,
        job_id: row.job_id,
        last_event: row.event_kind,
        tx_hash: row.tx_hash,
        block_number: row.block_number,
      },
    });

    batch.facts.push({
      code: "erc_8183_job_lifecycle",
      present: true,
      strength: "exact",
      refs: [jobNodeId, row.id],
    });

    linkParty(batch, row, jobNodeId, "client", "REQUESTER");
    linkParty(batch, row, jobNodeId, "provider", "PROVIDER");
    linkParty(batch, row, jobNodeId, "evaluator", "EVALUATOR");

    // Prefer payload keys from JobCreated / JobFunded etc.
    if (payload.client) linkAddress(batch, row.chain_id, String(payload.client), jobNodeId, "REQUESTER");
    if (payload.provider) linkAddress(batch, row.chain_id, String(payload.provider), jobNodeId, "PROVIDER");
    if (payload.evaluator) linkAddress(batch, row.chain_id, String(payload.evaluator), jobNodeId, "EVALUATOR");

    if (TERMINAL.has(row.event_kind)) {
      const outcomeId = ids.outcome(row.chain_id, row.job_id, row.event_kind);
      batch.nodes.push({
        label: "Outcome",
        id: outcomeId,
        props: {
          kind: row.event_kind,
          job_id: row.job_id,
          tx_hash: row.tx_hash,
          reason: payload.reason ?? null,
        },
      });
      batch.edges.push({ type: "HAS_OUTCOME", from: jobNodeId, to: outcomeId });
      if (row.event_kind === "JobCompleted") {
        batch.facts.push({
          code: "escrow_release_after_acceptance",
          present: true,
          strength: "strong",
          refs: [jobNodeId, outcomeId],
        });
      }
    }

    batch.nodes.push({
      label: "Evidence",
      id: ids.evidence(row.id),
      props: {
        type: "job_event",
        source: "erc8183",
        reference: row.id,
        event_kind: row.event_kind,
      },
    });
    batch.edges.push({
      type: "SUPPORTS",
      from: ids.evidence(row.id),
      to: jobNodeId,
      props: { claims: ["erc_8183_job_lifecycle"] },
    });
  }

  return batch;
}

function linkParty(
  batch: ProjectionBatch,
  row: Erc8183Row,
  jobNodeId: string,
  key: string,
  rel: "REQUESTER" | "PROVIDER" | "EVALUATOR",
) {
  const decoded = row.decoded ?? {};
  const addr = decoded[key];
  if (typeof addr === "string" && addr.startsWith("0x")) {
    linkAddress(batch, row.chain_id, addr, jobNodeId, rel);
  }
}

function linkAddress(
  batch: ProjectionBatch,
  chainId: string,
  address: string,
  jobNodeId: string,
  rel: "REQUESTER" | "PROVIDER" | "EVALUATOR",
) {
  if (!address || address === "0x0000000000000000000000000000000000000000") return;
  const walletId = ids.wallet(chainId, address);
  const agentId = ids.agentWallet(chainId, address);
  batch.nodes.push(
    { label: "Wallet", id: walletId, props: { chain_id: chainId, address: address.toLowerCase() } },
    {
      label: "Agent",
      id: agentId,
      props: { provisional: true, chain_id: chainId, wallet: address.toLowerCase() },
    },
  );
  batch.edges.push(
    { type: "CONTROLS", from: agentId, to: walletId },
    { type: rel, from: jobNodeId, to: agentId },
  );
}
