import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAgentUri } from "./agentUri.js";

describe("parseAgentUri", () => {
  it("parses inline JSON data URIs", () => {
    const uri =
      'data:application/json,{"name":"titan-1","type":"ai-agent","skills":["price-feed"]}';
    const parsed = parseAgentUri(uri);
    assert.equal(parsed.display_name, "titan-1");
    assert.ok(parsed.capabilities.includes("price-feed"));
  });

  it("parses base64 rich agent cards", () => {
    const body = Buffer.from(
      JSON.stringify({
        name: "ARC CCTP Agent",
        description: "Cross-chain settlement",
        role: "owner",
        skills: ["arc-cross-chain-settlement", "iris-attestation-poller"],
        scenario: {
          domain: { id: "cross-chain-settlement", name: "CCTP Settlement" },
          protocols: ["Gateway", "ERC-8004", "CCTP V2"],
        },
      }),
      "utf8",
    ).toString("base64");
    const parsed = parseAgentUri(`data:application/json;base64,${body}`);
    assert.equal(parsed.display_name, "ARC CCTP Agent");
    assert.match(parsed.blurb ?? "", /Cross-chain/);
    assert.ok(parsed.capabilities.includes("arc-cross-chain-settlement"));
    assert.ok(parsed.capabilities.includes("cctp-v2"));
    assert.ok(parsed.capability_text?.includes("ARC CCTP Agent"));
  });
});
