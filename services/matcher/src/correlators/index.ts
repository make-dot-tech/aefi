import { correlateErc8004 } from "./erc8004.js";
import { correlateErc8183 } from "./erc8183.js";
import { correlateMemoTransfers, correlateTransfers } from "./transfers.js";
import {
  collectAgentRelatedTxHashes,
  collectAgentWalletsFromRows,
} from "./agentWallets.js";
import {
  mergeBatches,
  type Erc8004Row,
  type Erc8183Row,
  type MemoRow,
  type ProjectionBatch,
  type TransferRow,
} from "../types.js";

export type CorrelatorName =
  | "transfers_payments"
  | "memo_transfer_same_tx"
  | "erc8183_job_lifecycle"
  | "erc8004_identity";

export function listCorrelators(): CorrelatorName[] {
  return [
    "transfers_payments",
    "memo_transfer_same_tx",
    "erc8183_job_lifecycle",
    "erc8004_identity",
  ];
}

export function runCorrelators(input: {
  transfers: TransferRow[];
  memos: MemoRow[];
  jobs: Erc8183Row[];
  agents: Erc8004Row[];
  /** Optional preloaded wallets (e.g. full-chain set from Postgres). */
  knownAgentWallets?: Set<string>;
}): ProjectionBatch {
  const agentWallets = new Set(input.knownAgentWallets ?? []);
  for (const addr of collectAgentWalletsFromRows(input.agents, input.jobs)) {
    agentWallets.add(addr);
  }
  const agentRelatedTxHashes = collectAgentRelatedTxHashes(
    input.jobs,
    input.memos,
  );
  const transferOpts = { agentWallets, agentRelatedTxHashes };

  return mergeBatches(
    correlateTransfers(input.transfers, transferOpts),
    correlateMemoTransfers(input.transfers, input.memos, transferOpts),
    correlateErc8183(input.jobs),
    correlateErc8004(input.agents),
  );
}

export {
  correlateTransfers,
  correlateMemoTransfers,
  correlateErc8183,
  correlateErc8004,
};
