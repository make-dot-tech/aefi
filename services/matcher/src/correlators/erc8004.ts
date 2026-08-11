import {
  emptyBatch,
  ids,
  type Erc8004Row,
  type ProjectionBatch,
} from "../types.js";
import { parseAgentUri } from "./agentUri.js";
import { extractAgentWallet } from "./agentWallets.js";

export function correlateErc8004(rows: Erc8004Row[]): ProjectionBatch {
  const batch = emptyBatch();
  const identityByAgent = new Map<
    string,
    ReturnType<typeof parseAgentUri>
  >();

  // Registered first so MetadataSet can copy identity onto wallet agents.
  const ordered = [...rows].sort((a, b) => {
    const rank = (k: string) => (k === "Registered" ? 0 : k === "MetadataSet" ? 1 : 2);
    return rank(a.event_kind) - rank(b.event_kind);
  });

  for (const row of ordered) {
    if (!row.agent_id) continue;
    const agentId = ids.agent8004(row.chain_id, row.agent_id);
    const props: Record<string, unknown> = {
      chain_id: row.chain_id,
      agent_id: row.agent_id,
      registry: row.registry,
      last_event: row.event_kind,
      identity_source: "erc_8004",
      last_tx: row.tx_hash,
      last_block: Number(row.block_number),
    };

    if (row.event_kind === "Registered") {
      const parsed = parseAgentUri(row.payload?.agentURI);
      identityByAgent.set(row.agent_id, parsed);
      if (parsed.display_name) props.display_name = parsed.display_name;
      if (parsed.blurb) props.blurb = parsed.blurb;
      if (parsed.capabilities.length) props.capabilities = parsed.capabilities;
      if (parsed.capability_text) props.capability_text = parsed.capability_text;
      if (parsed.role) props.role = parsed.role;
      if (typeof row.payload?.agentURI === "string") {
        props.agent_uri = row.payload.agentURI.slice(0, 500);
      }
      props.registered_tx = row.tx_hash;
      props.registered_block = Number(row.block_number);
      const owner = extractOwner(row);
      if (owner) props.owner = owner;
    }

    batch.nodes.push({
      label: "Agent",
      id: agentId,
      props,
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
      const walletAgentId = ids.agentWallet(row.chain_id, wallet);
      batch.nodes.push({
        label: "Wallet",
        id: walletId,
        props: { chain_id: row.chain_id, address: wallet.toLowerCase() },
      });
      batch.edges.push({ type: "CONTROLS", from: agentId, to: walletId });

      // Jobs PROVIDER → provisional wallet agents; copy identity so search surfaces names.
      const parsed =
        identityByAgent.get(row.agent_id) ?? parseAgentUri(undefined);
      const walletAgentProps: Record<string, unknown> = {
        chain_id: row.chain_id,
        wallet: wallet.toLowerCase(),
        provisional: true,
        linked_erc8004: agentId,
      };
      if (parsed.display_name) walletAgentProps.display_name = parsed.display_name;
      if (parsed.blurb) walletAgentProps.blurb = parsed.blurb;
      if (parsed.capabilities.length) {
        walletAgentProps.capabilities = parsed.capabilities;
      }
      if (parsed.capability_text) {
        walletAgentProps.capability_text = parsed.capability_text;
      }
      batch.nodes.push({
        label: "Agent",
        id: walletAgentId,
        props: walletAgentProps,
      });
      batch.edges.push({
        type: "CONTROLS",
        from: walletAgentId,
        to: walletId,
      });
    }
  }

  return batch;
}

function extractOwner(row: Erc8004Row): string | null {
  const p = row.payload ?? {};
  for (const key of ["owner", "agentOwner", "creator"]) {
    const v = p[key];
    if (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v)) {
      return v.toLowerCase();
    }
  }
  return null;
}
