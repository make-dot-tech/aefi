/**
 * One-shot: purge demo seed nodes and backfill ERC-8004 identity from Postgres.
 * Usage: pnpm --filter @aefi/matcher enrich:identity
 */
import pg from "pg";
import neo4j from "neo4j-driver";
import { loadConfig } from "../config.js";
import { parseAgentUri } from "../correlators/agentUri.js";
import { ids } from "../types.js";

async function main() {
  const cfg = loadConfig();
  const url = new URL(cfg.databaseUrl.replace(/^postgres(ql)?:/, "http:"));
  const pool = new pg.Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "aefi",
    ssl:
      url.searchParams.get("sslmode") === "disable"
        ? false
        : { rejectUnauthorized: false },
  });
  const driver = neo4j.driver(
    cfg.neo4jUri,
    neo4j.auth.basic(cfg.neo4jUser, cfg.neo4jPassword),
  );

  const session = driver.session();
  try {
    const purged = await session.run(`
      MATCH (n)
      WHERE coalesce(n.demo, false) = true
         OR n.id STARTS WITH 'agent:demo:'
         OR n.id STARTS WITH 'job:demo:'
         OR n.id STARTS WITH 'pay:demo:'
         OR n.id STARTS WITH 'xfer:demo:'
         OR n.id STARTS WITH 'evidence:demo:'
         OR n.id STARTS WITH 'ev:demo:'
      DETACH DELETE n
      RETURN count(*) AS deleted
    `);
    console.log(
      `Purged demo nodes: ${purged.records[0]?.get("deleted")?.toNumber?.() ?? purged.records[0]?.get("deleted")}`,
    );

    const { rows } = await pool.query<{
      agent_id: string;
      chain_id: string;
      event_kind: string;
      payload: Record<string, unknown>;
    }>(
      `
      SELECT e.agent_id, b.chain_id::text AS chain_id, e.event_kind, e.payload
      FROM evt_erc8004 e
      JOIN evt_base b ON b.id = e.id
      WHERE e.agent_id IS NOT NULL
        AND e.event_kind IN ('Registered', 'MetadataSet')
        AND b.chain_id = $1
      ORDER BY b.block_number, b.log_index
      `,
      [cfg.chainId],
    );

    const byAgent = new Map<
      string,
      {
        display_name?: string;
        blurb?: string;
        capabilities?: string[];
        capability_text?: string;
        role?: string;
        wallet?: string;
        agent_uri?: string;
      }
    >();

    for (const row of rows) {
      const cur = byAgent.get(row.agent_id) ?? {};
      if (row.event_kind === "Registered") {
        const parsed = parseAgentUri(row.payload?.agentURI);
        if (parsed.display_name) cur.display_name = parsed.display_name;
        if (parsed.blurb) cur.blurb = parsed.blurb;
        if (parsed.capabilities.length) cur.capabilities = parsed.capabilities;
        if (parsed.capability_text) cur.capability_text = parsed.capability_text;
        if (parsed.role) cur.role = parsed.role;
        if (typeof row.payload?.agentURI === "string") {
          cur.agent_uri = row.payload.agentURI.slice(0, 500);
        }
      }
      if (row.event_kind === "MetadataSet") {
        const key = String(row.payload?.metadataKey ?? "");
        const val = row.payload?.metadataValue;
        if (key === "agentWallet" && typeof val === "string") {
          const hex = val.startsWith("0x") ? val.slice(2) : val;
          if (hex.length >= 40) cur.wallet = `0x${hex.slice(-40).toLowerCase()}`;
        }
      }
      byAgent.set(row.agent_id, cur);
    }

    let updated = 0;
    const entries = [...byAgent.entries()];
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      await session.executeWrite(async (tx) => {
        for (const [agentId, meta] of chunk) {
          const nodeId = ids.agent8004(cfg.chainId, agentId);
          await tx.run(
            `
            MERGE (a:Agent {id: $id})
            SET a.chain_id = $chainId,
                a.agent_id = $agentId,
                a.identity_source = 'erc_8004',
                a.display_name = coalesce($display_name, a.display_name),
                a.blurb = coalesce($blurb, a.blurb),
                a.capabilities = coalesce($capabilities, a.capabilities),
                a.capability_text = coalesce($capability_text, a.capability_text),
                a.role = coalesce($role, a.role),
                a.agent_uri = coalesce($agent_uri, a.agent_uri)
            `,
            {
              id: nodeId,
              chainId: cfg.chainId,
              agentId,
              display_name: meta.display_name ?? null,
              blurb: meta.blurb ?? null,
              capabilities: meta.capabilities ?? null,
              capability_text: meta.capability_text ?? null,
              role: meta.role ?? null,
              agent_uri: meta.agent_uri ?? null,
            },
          );
          if (meta.wallet) {
            const walletId = ids.wallet(cfg.chainId, meta.wallet);
            const walletAgentId = ids.agentWallet(cfg.chainId, meta.wallet);
            await tx.run(
              `
              MERGE (w:Wallet {id: $walletId})
              SET w.chain_id = $chainId, w.address = $wallet
              MERGE (a:Agent {id: $agentId})
              MERGE (a)-[:CONTROLS]->(w)
              MERGE (wa:Agent {id: $walletAgentId})
              SET wa.chain_id = $chainId,
                  wa.wallet = $wallet,
                  wa.provisional = true,
                  wa.linked_erc8004 = $agentId,
                  wa.display_name = coalesce($display_name, wa.display_name),
                  wa.blurb = coalesce($blurb, wa.blurb),
                  wa.capabilities = coalesce($capabilities, wa.capabilities),
                  wa.capability_text = coalesce($capability_text, wa.capability_text)
              MERGE (wa)-[:CONTROLS]->(w)
              `,
              {
                walletId,
                chainId: cfg.chainId,
                wallet: meta.wallet,
                agentId: nodeId,
                walletAgentId,
                display_name: meta.display_name ?? null,
                blurb: meta.blurb ?? null,
                capabilities: meta.capabilities ?? null,
                capability_text: meta.capability_text ?? null,
              },
            );
          }
          updated += 1;
        }
      });
      console.log(`Identity upsert ${Math.min(i + 100, entries.length)}/${entries.length}`);
    }
    console.log(`Updated ${updated} ERC-8004 agents from Postgres`);
  } finally {
    await session.close();
    await driver.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
