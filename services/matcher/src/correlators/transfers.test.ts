import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { correlateMemoTransfers, correlateTransfers } from "./transfers.js";
import type { MemoRow, TransferRow } from "../types.js";

const AGENT = "0x2222222222222222222222222222222222222222";
const OTHER = "0x1111111111111111111111111111111111111111";
const STRANGER = "0x3333333333333333333333333333333333333333";

function transfer(
  partial: Partial<TransferRow> & Pick<TransferRow, "id" | "tx_hash" | "log_index">,
): TransferRow {
  return {
    chain_id: "5042002",
    block_number: "1",
    address: "0xfffffffffffffffffffffffffffffffffffffffe",
    event_name: "Transfer",
    decoded: {},
    from_addr: OTHER,
    to_addr: AGENT,
    value: "1000",
    decimals: 18,
    emitter_role: "system_usdc",
    ...partial,
  };
}

const agentOpts = {
  agentWallets: new Set([AGENT]),
  agentRelatedTxHashes: new Set<string>(),
};

describe("correlateTransfers", () => {
  it("creates payment settled by transfer for agent wallets", () => {
    const batch = correlateTransfers(
      [
        transfer({
          id: "evt:5042002:0xabc:0",
          tx_hash: "0xabc",
          log_index: 0,
        }),
      ],
      agentOpts,
    );
    assert.ok(batch.nodes.some((n) => n.label === "Payment"));
    assert.ok(batch.edges.some((e) => e.type === "SETTLED_BY"));
  });

  it("skips transfers that do not touch known agents", () => {
    const batch = correlateTransfers(
      [
        transfer({
          id: "evt:5042002:0xdef:0",
          tx_hash: "0xdef",
          log_index: 0,
          from_addr: OTHER,
          to_addr: STRANGER,
        }),
      ],
      agentOpts,
    );
    assert.equal(batch.nodes.length, 0);
    assert.equal(batch.edges.length, 0);
  });

  it("includes transfers on job-related txs even without wallet match", () => {
    const batch = correlateTransfers(
      [
        transfer({
          id: "evt:5042002:0xjob:0",
          tx_hash: "0xjobtx",
          log_index: 0,
          from_addr: OTHER,
          to_addr: STRANGER,
        }),
      ],
      {
        agentWallets: new Set(),
        agentRelatedTxHashes: new Set(["0xjobtx"]),
      },
    );
    assert.ok(batch.nodes.some((n) => n.label === "Payment"));
  });
});

describe("correlateMemoTransfers", () => {
  it("annotates payment when memo shares tx", () => {
    const transfers = [
      transfer({ id: "evt:5042002:0xabc:1", tx_hash: "0xabc", log_index: 1 }),
    ];
    const memos: MemoRow[] = [
      {
        id: "evt:5042002:0xabc:0",
        chain_id: "5042002",
        block_number: "1",
        tx_hash: "0xabc",
        log_index: 0,
        address: "0x5294e9927c3306dcbadb03fe70b92e01ccede505",
        event_name: "Memo",
        decoded: { job_id: "42" },
        sender: OTHER,
        memo_id: "0xaaa",
        payload: null,
        call_data_hash: "0xbbb",
      },
    ];
    const batch = correlateMemoTransfers(transfers, memos, agentOpts);
    assert.ok(batch.edges.some((e) => e.type === "ANNOTATED_BY"));
    assert.ok(batch.edges.some((e) => e.type === "FOR_JOB"));
    assert.ok(batch.facts.some((f) => f.code === "exact_job_id_memo" && f.present));
  });
});
