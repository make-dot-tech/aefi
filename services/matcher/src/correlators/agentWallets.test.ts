import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectAgentRelatedTxHashes,
  collectAgentWalletsFromRows,
  isAgentRelatedTransfer,
  normalizeAddress,
} from "./agentWallets.js";
import type { Erc8004Row, Erc8183Row, MemoRow } from "../types.js";

describe("agentWallets", () => {
  it("normalizes padded hex metadata values", () => {
    assert.equal(
      normalizeAddress(
        "0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("collects agentWallet and 8183 parties", () => {
    const agents: Erc8004Row[] = [
      {
        id: "evt:1",
        chain_id: "5042002",
        block_number: "1",
        tx_hash: "0x1",
        log_index: 0,
        address: "0xreg",
        event_name: "MetadataSet",
        decoded: {},
        registry: "identity",
        event_kind: "MetadataSet",
        agent_id: "1",
        payload: {
          metadataKey: "agentWallet",
          metadataValue:
            "0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
    ];
    const jobs: Erc8183Row[] = [
      {
        id: "evt:2",
        chain_id: "5042002",
        block_number: "2",
        tx_hash: "0x2",
        log_index: 0,
        address: "0xjob",
        event_name: "JobCreated",
        decoded: { provider: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC" },
        job_id: "9",
        event_kind: "JobCreated",
        payload: { client: "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD" },
      },
    ];
    const wallets = collectAgentWalletsFromRows(agents, jobs);
    assert.ok(wallets.has("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    assert.ok(wallets.has("0xcccccccccccccccccccccccccccccccccccccccc"));
    assert.ok(wallets.has("0xdddddddddddddddddddddddddddddddddddddddd"));
  });

  it("marks job memo txs as agent-related", () => {
    const memos: MemoRow[] = [
      {
        id: "evt:m",
        chain_id: "5042002",
        block_number: "1",
        tx_hash: "0xMEMO",
        log_index: 0,
        address: "0xmemo",
        event_name: "Memo",
        decoded: { job_id: "7" },
        sender: "0x1",
        memo_id: null,
        payload: null,
        call_data_hash: null,
      },
    ];
    const txs = collectAgentRelatedTxHashes([], memos);
    assert.ok(txs.has("0xmemo"));
    assert.ok(
      isAgentRelatedTransfer(
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0xmemo",
        new Set(),
        txs,
      ),
    );
  });
});
