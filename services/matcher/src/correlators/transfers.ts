import {
  emptyBatch,
  ids,
  type MemoRow,
  type ProjectionBatch,
  type TransferRow,
} from "../types.js";
import { isAgentRelatedTransfer } from "./agentWallets.js";

export interface TransferCorrelateOpts {
  /** Lowercase 0x wallets known as ERC-8004 agentWallet or ERC-8183 parties. */
  agentWallets: Set<string>;
  /** Tx hashes tied to jobs (8183 events or memos with job id). */
  agentRelatedTxHashes: Set<string>;
}

/** Payment + wallets + transfer nodes for agent-related system USDC settlements. */
export function correlateTransfers(
  rows: TransferRow[],
  opts: TransferCorrelateOpts,
): ProjectionBatch {
  const batch = emptyBatch();
  for (const t of rows) {
    if (t.emitter_role !== "system_usdc") continue;
    if (
      !isAgentRelatedTransfer(
        t.from_addr,
        t.to_addr,
        t.tx_hash,
        opts.agentWallets,
        opts.agentRelatedTxHashes,
      )
    ) {
      continue;
    }

    const xferId = ids.transfer(t.id);
    const payId = ids.payment(t.chain_id, t.tx_hash, t.log_index);
    const fromWallet = ids.wallet(t.chain_id, t.from_addr);
    const toWallet = ids.wallet(t.chain_id, t.to_addr);

    batch.nodes.push(
      {
        label: "TransferEvent",
        id: xferId,
        props: {
          evt_id: t.id,
          chain_id: t.chain_id,
          tx_hash: t.tx_hash,
          log_index: t.log_index,
          block_number: t.block_number,
          from: t.from_addr,
          to: t.to_addr,
          value: t.value,
          decimals: t.decimals,
          emitter_role: t.emitter_role,
        },
      },
      {
        label: "Payment",
        id: payId,
        props: {
          chain_id: t.chain_id,
          tx_hash: t.tx_hash,
          log_index: t.log_index,
          amount: t.value,
          asset: "USDC",
          decimals: t.decimals,
          status: "settled",
        },
      },
      {
        label: "Wallet",
        id: fromWallet,
        props: { chain_id: t.chain_id, address: t.from_addr },
      },
      {
        label: "Wallet",
        id: toWallet,
        props: { chain_id: t.chain_id, address: t.to_addr },
      },
      {
        label: "Evidence",
        id: ids.evidence(t.id),
        props: {
          type: "transaction",
          source: "arc_system_usdc",
          reference: t.id,
        },
      },
    );

    batch.edges.push(
      { type: "SETTLED_BY", from: payId, to: xferId },
      { type: "FROM_WALLET", from: payId, to: fromWallet },
      { type: "TO_WALLET", from: payId, to: toWallet },
      {
        type: "SUPPORTS",
        from: ids.evidence(t.id),
        to: payId,
        props: { claims: ["payment_settled"] },
      },
    );

    batch.facts.push({
      code: "payment_only_observed",
      present: true,
      strength: "exact",
      refs: [payId, xferId],
    });
  }
  return batch;
}

/** Same-tx Memo ↔ Transfer join → annotate payments. */
export function correlateMemoTransfers(
  transfers: TransferRow[],
  memos: MemoRow[],
  opts: TransferCorrelateOpts,
): ProjectionBatch {
  const batch = emptyBatch();
  const memosByTx = new Map<string, MemoRow[]>();
  for (const m of memos) {
    const list = memosByTx.get(m.tx_hash) ?? [];
    list.push(m);
    memosByTx.set(m.tx_hash, list);
  }

  for (const t of transfers) {
    if (t.emitter_role !== "system_usdc") continue;
    if (
      !isAgentRelatedTransfer(
        t.from_addr,
        t.to_addr,
        t.tx_hash,
        opts.agentWallets,
        opts.agentRelatedTxHashes,
      )
    ) {
      continue;
    }
    const related = memosByTx.get(t.tx_hash);
    if (!related?.length) continue;

    const payId = ids.payment(t.chain_id, t.tx_hash, t.log_index);

    for (const m of related) {
      const memoNodeId = ids.memo(m.id);
      batch.nodes.push({
        label: "MemoEvent",
        id: memoNodeId,
        props: {
          evt_id: m.id,
          chain_id: m.chain_id,
          tx_hash: m.tx_hash,
          sender: m.sender,
          memo_id: m.memo_id,
          payload: m.payload,
          call_data_hash: m.call_data_hash,
        },
      });
      batch.edges.push({
        type: "ANNOTATED_BY",
        from: payId,
        to: memoNodeId,
        props: { join: "same_tx_hash" },
      });

      const jobFromMemo = extractJobId(m);
      if (jobFromMemo) {
        const jobNodeId = ids.job(m.chain_id, jobFromMemo);
        batch.nodes.push({
          label: "Job",
          id: jobNodeId,
          props: { chain_id: m.chain_id, job_id: jobFromMemo, source: "memo" },
        });
        batch.edges.push({ type: "FOR_JOB", from: payId, to: jobNodeId });
        batch.facts.push({
          code: "exact_job_id_memo",
          present: true,
          strength: "exact",
          refs: [payId, memoNodeId, jobNodeId],
        });
      } else {
        batch.facts.push({
          code: "exact_job_id_memo",
          present: false,
          refs: [payId, memoNodeId],
        });
      }
    }
  }
  return batch;
}

function extractJobId(m: MemoRow): string | null {
  const decoded = m.decoded ?? {};
  for (const key of ["jobId", "job_id", "jobID"]) {
    const v = decoded[key];
    if (v !== undefined && v !== null && String(v).length) return String(v);
  }
  if (m.payload?.startsWith("0x")) {
    try {
      const hex = m.payload.slice(2);
      const text = Buffer.from(hex, "hex").toString("utf8");
      if (text.startsWith("{")) {
        const obj = JSON.parse(text) as Record<string, unknown>;
        for (const key of ["job_id", "jobId"]) {
          if (obj[key] != null) return String(obj[key]);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}
