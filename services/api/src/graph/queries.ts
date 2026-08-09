import neo4j, { type Driver, type Record as NeoRecord } from "neo4j-driver";
import { loadChainId, loadNeo4jConfig } from "../lib/config.js";

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const cfg = loadNeo4jConfig();
    driver = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.user, cfg.password));
  }
  return driver;
}

export function chainId(): string {
  return loadChainId();
}

/** Prefer same-chain nodes when multiple networks share one Aura instance. */
function chainClause(alias: string): string {
  return `(${alias}.chain_id IS NULL OR toString(${alias}.chain_id) = $chainId)`;
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

export type Props = Record<string, unknown>;

export interface PaymentView {
  payment: Props;
  transfer: Props | null;
  fromWallet: Props | null;
  toWallet: Props | null;
  memos: Props[];
  jobs: Props[];
  evidence: Props[];
}

export interface TxExplainView {
  tx_hash: string;
  payments: PaymentView[];
  memos: Props[];
  jobs: Props[];
  transfers: Props[];
}

export interface JobView {
  job: Props;
  requesters: Props[];
  providers: Props[];
  evaluators: Props[];
  outcomes: Props[];
  payments: Props[];
  evidence: Props[];
}

export interface ActivityItem {
  kind: string;
  id: string;
  props: Props;
}

function propsOf(rec: NeoRecord, key: string): Props | null {
  const node = rec.get(key);
  if (!node) return null;
  return { id: node.properties.id, ...node.properties };
}

function propsList(rec: NeoRecord, key: string): Props[] {
  const nodes = rec.get(key) as Array<{ properties: Props }> | null;
  if (!nodes) return [];
  return nodes
    .filter(Boolean)
    .map((n) => ({ id: n.properties.id, ...n.properties }));
}

export async function findPaymentsByTx(txHash: string): Promise<PaymentView[]> {
  const session = getDriver().session();
  const hash = txHash.toLowerCase();
  try {
    const result = await session.run(
      `
      MATCH (p:Payment {tx_hash: $hash})
      WHERE ${chainClause("p")}
      OPTIONAL MATCH (p)-[:SETTLED_BY]->(t:TransferEvent)
      OPTIONAL MATCH (p)-[:FROM_WALLET]->(fw:Wallet)
      OPTIONAL MATCH (p)-[:TO_WALLET]->(tw:Wallet)
      OPTIONAL MATCH (p)-[:ANNOTATED_BY]->(m:MemoEvent)
      OPTIONAL MATCH (p)-[:FOR_JOB]->(j:Job)
      OPTIONAL MATCH (e:Evidence)-[:SUPPORTS]->(p)
      RETURN p, t, fw, tw,
             collect(DISTINCT m) AS memos,
             collect(DISTINCT j) AS jobs,
             collect(DISTINCT e) AS evidence
      `,
      { hash, chainId: chainId() },
    );
    return result.records.map((rec) => ({
      payment: propsOf(rec, "p")!,
      transfer: propsOf(rec, "t"),
      fromWallet: propsOf(rec, "fw"),
      toWallet: propsOf(rec, "tw"),
      memos: propsList(rec, "memos"),
      jobs: propsList(rec, "jobs"),
      evidence: propsList(rec, "evidence"),
    }));
  } finally {
    await session.close();
  }
}

export async function findPaymentById(paymentId: string): Promise<PaymentView | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `
      MATCH (p:Payment {id: $id})
      WHERE ${chainClause("p")}
      OPTIONAL MATCH (p)-[:SETTLED_BY]->(t:TransferEvent)
      OPTIONAL MATCH (p)-[:FROM_WALLET]->(fw:Wallet)
      OPTIONAL MATCH (p)-[:TO_WALLET]->(tw:Wallet)
      OPTIONAL MATCH (p)-[:ANNOTATED_BY]->(m:MemoEvent)
      OPTIONAL MATCH (p)-[:FOR_JOB]->(j:Job)
      OPTIONAL MATCH (e:Evidence)-[:SUPPORTS]->(p)
      RETURN p, t, fw, tw,
             collect(DISTINCT m) AS memos,
             collect(DISTINCT j) AS jobs,
             collect(DISTINCT e) AS evidence
      LIMIT 1
      `,
      { id: paymentId, chainId: chainId() },
    );
    const rec = result.records[0];
    if (!rec) return null;
    return {
      payment: propsOf(rec, "p")!,
      transfer: propsOf(rec, "t"),
      fromWallet: propsOf(rec, "fw"),
      toWallet: propsOf(rec, "tw"),
      memos: propsList(rec, "memos"),
      jobs: propsList(rec, "jobs"),
      evidence: propsList(rec, "evidence"),
    };
  } finally {
    await session.close();
  }
}

export async function explainTx(txHash: string): Promise<TxExplainView> {
  const hash = txHash.toLowerCase();
  const payments = await findPaymentsByTx(hash);
  const session = getDriver().session();
  const cid = chainId();
  try {
    const result = await session.run(
      `
      OPTIONAL MATCH (t:TransferEvent {tx_hash: $hash})
      WHERE ${chainClause("t")}
      OPTIONAL MATCH (m:MemoEvent {tx_hash: $hash})
      WHERE ${chainClause("m")}
      OPTIONAL MATCH (j:Job {tx_hash: $hash})
      WHERE ${chainClause("j")}
      RETURN collect(DISTINCT t) AS transfers,
             collect(DISTINCT m) AS memos,
             collect(DISTINCT j) AS jobs
      `,
      { hash, chainId: cid },
    );
    const rec = result.records[0];
    return {
      tx_hash: hash,
      payments,
      transfers: rec ? propsList(rec, "transfers") : [],
      memos: rec ? propsList(rec, "memos") : [],
      jobs: rec ? propsList(rec, "jobs") : [],
    };
  } finally {
    await session.close();
  }
}

export async function findJob(jobKey: string): Promise<JobView | null> {
  const session = getDriver().session();
  const cid = chainId();
  // Accept full id or numeric job_id (optionally with chain prefix).
  const candidates = [jobKey];
  if (/^\d+$/.test(jobKey)) {
    candidates.push(`job:erc8183:${cid}:${jobKey}`);
  }
  try {
    const result = await session.run(
      `
      MATCH (j:Job)
      WHERE (j.id IN $candidates OR j.job_id = $jobKey)
        AND ${chainClause("j")}
      WITH j LIMIT 1
      OPTIONAL MATCH (j)-[:REQUESTER]->(req:Agent)
      OPTIONAL MATCH (j)-[:PROVIDER]->(prov:Agent)
      OPTIONAL MATCH (j)-[:EVALUATOR]->(eval:Agent)
      OPTIONAL MATCH (j)-[:HAS_OUTCOME]->(o:Outcome)
      OPTIONAL MATCH (p:Payment)-[:FOR_JOB]->(j)
      OPTIONAL MATCH (e:Evidence)-[:SUPPORTS]->(j)
      RETURN j,
             collect(DISTINCT req) AS requesters,
             collect(DISTINCT prov) AS providers,
             collect(DISTINCT eval) AS evaluators,
             collect(DISTINCT o) AS outcomes,
             collect(DISTINCT p) AS payments,
             collect(DISTINCT e) AS evidence
      `,
      { candidates, jobKey, chainId: cid },
    );
    const rec = result.records[0];
    if (!rec || !rec.get("j")) return null;
    return {
      job: propsOf(rec, "j")!,
      requesters: propsList(rec, "requesters"),
      providers: propsList(rec, "providers"),
      evaluators: propsList(rec, "evaluators"),
      outcomes: propsList(rec, "outcomes"),
      payments: propsList(rec, "payments"),
      evidence: propsList(rec, "evidence"),
    };
  } finally {
    await session.close();
  }
}

export async function findAgentActivity(
  id: string,
  limit = 25,
): Promise<{ agent: Props | null; wallet: Props | null; items: ActivityItem[] }> {
  const session = getDriver().session();
  const key = id.toLowerCase();
  const cid = chainId();
  try {
    // Resolve agent by id, or wallet by address / wallet id.
    const agentRes = await session.run(
      `
      OPTIONAL MATCH (a:Agent)
      WHERE (toLower(a.id) = $key OR toLower(coalesce(a.agent_id,'')) = $key)
        AND ${chainClause("a")}
      WITH a LIMIT 1
      OPTIONAL MATCH (w:Wallet)
      WHERE (toLower(w.id) = $key OR toLower(w.address) = $key
         OR ($key STARTS WITH '0x' AND toLower(w.address) = $key))
        AND ${chainClause("w")}
      WITH a, w LIMIT 1
      RETURN a, w
      `,
      { key, chainId: cid },
    );
    const arec = agentRes.records[0];
    const agent = arec ? propsOf(arec, "a") : null;
    let wallet = arec ? propsOf(arec, "w") : null;

    if (agent && !wallet) {
      const wr = await session.run(
        `MATCH (a:Agent {id: $id})-[:CONTROLS]->(w:Wallet)
         WHERE ${chainClause("w")}
         RETURN w LIMIT 1`,
        { id: agent.id, chainId: cid },
      );
      wallet = wr.records[0] ? propsOf(wr.records[0], "w") : null;
    }

    const items: ActivityItem[] = [];

    if (wallet?.address) {
      const payRes = await session.run(
        `
        MATCH (p:Payment)-[:FROM_WALLET|TO_WALLET]->(w:Wallet {address: $addr})
        WHERE ${chainClause("p")} AND ${chainClause("w")}
        RETURN p LIMIT $limit
        `,
        {
          addr: String(wallet.address).toLowerCase(),
          limit: neo4j.int(limit),
          chainId: cid,
        },
      );
      for (const rec of payRes.records) {
        const p = propsOf(rec, "p");
        if (p) items.push({ kind: "payment", id: String(p.id), props: p });
      }
    }

    if (agent?.id) {
      const evRes = await session.run(
        `
        MATCH (e:Evidence)-[:SUPPORTS]->(a:Agent {id: $id})
        WHERE ${chainClause("a")}
        RETURN e ORDER BY e.reference DESC LIMIT $limit
        `,
        { id: agent.id, limit: neo4j.int(limit), chainId: cid },
      );
      for (const rec of evRes.records) {
        const e = propsOf(rec, "e");
        if (e) items.push({ kind: "evidence", id: String(e.id), props: e });
      }

      const jobRes = await session.run(
        `
        MATCH (j:Job)-[:REQUESTER|PROVIDER|EVALUATOR]->(a:Agent {id: $id})
        WHERE ${chainClause("j")} AND ${chainClause("a")}
        RETURN j LIMIT $limit
        `,
        { id: agent.id, limit: neo4j.int(limit), chainId: cid },
      );
      for (const rec of jobRes.records) {
        const j = propsOf(rec, "j");
        if (j) items.push({ kind: "job", id: String(j.id), props: j });
      }
    }

    return { agent, wallet, items };
  } finally {
    await session.close();
  }
}
