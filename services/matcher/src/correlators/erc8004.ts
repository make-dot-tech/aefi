import {
  emptyBatch,
  ids,
  type Erc8004Row,
  type ProjectionBatch,
} from "../types.js";

export function correlateErc8004(rows: Erc8004Row[]): ProjectionBatch {
  const batch = emptyBatch();

  for (const row of rows) {
    if (!row.agent_id) continue;
    const agentId = ids.agent8004(row.chain_id, row.agent_id);

    batch.nodes.push({
      label: "Agent",
      id: agentId,
      props: {
        chain_id: row.chain_id,
        agent_id: row.agent_id,
        registry: row.registry,
        last_event: row.event_kind,
        identity_source: "erc_8004",
      },
    });

    batch.facts.push({
      code: "erc_8004_identity_match",
      present: true,
      strength: "exact",
      refs: [agentId, row.id],
    });

    if (row.event_kind === "NewFeedback") {
      batch.facts.push({
        code: "erc_8004_reputation_event",
        present: true,
        strength: "strong",
        refs: [agentId, row.id],
      });
    }

    const evidenceId = ids.evidence(row.id);
    batch.nodes.push({
      label: "Evidence",
      id: evidenceId,
      props: {
        type:
          row.event_kind === "NewFeedback" ? "reputation_event" : "identity_event",
        source: `erc8004_${row.registry}`,
        reference: row.id,
        event_kind: row.event_kind,
      },
    });
    batch.edges.push({
      type: "SUPPORTS",
      from: evidenceId,
      to: agentId,
      props: {
        claims:
          row.event_kind === "NewFeedback"
            ? ["erc_8004_reputation_event"]
            : ["erc_8004_identity_match"],
      },
    });

    const wallet = extractAgentWallet(row);
    if (wallet) {
      const walletId = ids.wallet(row.chain_id, wallet);
      batch.nodes.push({
        label: "Wallet",
        id: walletId,
        props: { chain_id: row.chain_id, address: wallet.toLowerCase() },
      });
      batch.edges.push({ type: "CONTROLS", from: agentId, to: walletId });
    }
  }

  return batch;
}

function extractAgentWallet(row: Erc8004Row): string | null {
  const p = row.payload ?? {};
  if (row.event_kind === "MetadataSet") {
    const key = String(p.metadataKey ?? "");
    if (key === "agentWallet" && typeof p.metadataValue === "string") {
      const hex = p.metadataValue.startsWith("0x")
        ? p.metadataValue.slice(2)
        : p.metadataValue;
      if (hex.length >= 40) {
        return `0x${hex.slice(-40)}`;
      }
    }
  }
  return null;
}
