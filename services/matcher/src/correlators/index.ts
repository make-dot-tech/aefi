import { correlateErc8004 } from "./erc8004.js";
import { correlateErc8183 } from "./erc8183.js";
import { correlateMemoTransfers, correlateTransfers } from "./transfers.js";
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
}): ProjectionBatch {
  return mergeBatches(
    correlateTransfers(input.transfers),
    correlateMemoTransfers(input.transfers, input.memos),
    correlateErc8183(input.jobs),
    correlateErc8004(input.agents),
  );
}

export { correlateTransfers, correlateMemoTransfers, correlateErc8183, correlateErc8004 };
