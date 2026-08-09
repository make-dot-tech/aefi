import { getDriver } from "../graph/queries.js";
import { loadChainId } from "../lib/config.js";

export interface SeedProviderSpec {
  id: string;
  name: string;
  wallet: string;
  capabilities: string[];
  blurb: string;
  jobs: Array<{
    job_id: string;
    outcome: "JobCompleted" | "JobRejected" | "JobExpired";
    tx_hash: string;
    amount: string;
    with_payment: boolean;
  }>;
  feedback: number;
}

/** Flagship demo roster — seeking agent comparing market-data providers. */
export const DEMO_PROVIDERS: SeedProviderSpec[] = [
  {
    id: "agent:demo:nova",
    name: "NovaFeed",
    wallet: "0xnova000000000000000000000000000000000001",
    capabilities: ["market-data", "price-oracle"],
    blurb: "High-reliability market data with dense settlement evidence.",
    feedback: 18,
    jobs: buildJobs("nova", 48, 0.979, 0.92),
  },
  {
    id: "agent:demo:pulse",
    name: "PulseOracle",
    wallet: "0xpulse00000000000000000000000000000000002",
    capabilities: ["market-data"],
    blurb: "Solid mid-tier feed; more rejects, thinner payment linkage.",
    feedback: 7,
    jobs: buildJobs("pulse", 31, 0.87, 0.55),
  },
  {
    id: "agent:demo:cheap",
    name: "CheapTicks",
    wallet: "0xcheap00000000000000000000000000000000003",
    capabilities: ["market-data"],
    blurb: "Low cost, noisy outcomes — evidence says proceed with caution.",
    feedback: 2,
    jobs: buildJobs("cheap", 22, 0.68, 0.35),
  },
  {
    id: "agent:demo:helix",
    name: "HelixResearch",
    wallet: "0xhelix00000000000000000000000000000000004",
    capabilities: ["research-ops", "report-writing"],
    blurb: "Research specialist — different capability lane.",
    feedback: 11,
    jobs: buildJobs("helix", 27, 0.96, 0.88, "research-ops"),
  },
];

function buildJobs(
  slug: string,
  total: number,
  completionRate: number,
  paymentRate: number,
  capability = "market-data",
): SeedProviderSpec["jobs"] {
  const completed = Math.round(total * completionRate);
  const rejected = Math.max(0, Math.floor((total - completed) * 0.7));
  const expired = total - completed - rejected;
  const jobs: SeedProviderSpec["jobs"] = [];
  let i = 0;
  const push = (
    outcome: SeedProviderSpec["jobs"][0]["outcome"],
    n: number,
  ) => {
    for (let k = 0; k < n; k++) {
      i += 1;
      const job_id = `${slug}-${i}`;
      const tx_hash = `0xdemo${slug.padEnd(8, "0").slice(0, 8)}${i.toString(16).padStart(48, "0")}`.slice(0, 66);
      jobs.push({
        job_id,
        outcome,
        tx_hash,
        amount: String(1_000_000 + i * 25_000),
        with_payment: i / total <= paymentRate,
      });
      void capability;
    }
  };
  push("JobCompleted", completed);
  push("JobRejected", rejected);
  push("JobExpired", expired);
  // stamp capability via outer job props in seed
  return jobs.map((j) => ({ ...j }));
}

const CHAIN = loadChainId();

export async function seedDemoProviders(): Promise<{
  providers: number;
  jobs: number;
  embeddings?: number;
}> {
  const session = getDriver().session();
  let jobCount = 0;
  try {
    for (const p of DEMO_PROVIDERS) {
      const walletId = `wallet:${CHAIN}:${p.wallet}`;
      const capability = p.capabilities[0] ?? "market-data";
      jobCount += p.jobs.length;

      const feedbackRows = Array.from({ length: p.feedback }, (_, fi) => ({
        evid: `evidence:demo:feedback:${p.id}:${fi}`,
      }));

      const jobRows = p.jobs.map((job) => ({
        jobId: `job:erc8183:${CHAIN}:${job.job_id}`,
        jobKey: job.job_id,
        outcome: job.outcome,
        tx: job.tx_hash,
        outcomeId: `outcome:${CHAIN}:${job.job_id}:${job.outcome}`,
        jobEvid: `evidence:demo:job:${job.job_id}`,
      }));

      const payRows = p.jobs
        .filter((j) => j.with_payment)
        .map((job) => ({
          jobId: `job:erc8183:${CHAIN}:${job.job_id}`,
          payId: `pay:demo:${job.job_id}`,
          xferId: `xfer:demo:${job.job_id}`,
          tx: job.tx_hash,
          amount: job.amount,
          payEvid: `evidence:demo:pay:${job.job_id}`,
        }));

      await session.executeWrite(async (tx) => {
        await tx.run(
          `
          MERGE (a:Agent {id: $id})
          SET a.display_name = $name,
              a.name = $name,
              a.wallet = $wallet,
              a.capabilities = $capabilities,
              a.capability = $capabilities[0],
              a.capability_text = $capabilityText,
              a.demo = true,
              a.blurb = $blurb,
              a.chain_id = $chain
          MERGE (w:Wallet {id: $walletId})
          SET w.address = $wallet, w.chain_id = $chain, w.demo = true
          MERGE (a)-[:CONTROLS]->(w)
          `,
          {
            id: p.id,
            name: p.name,
            wallet: p.wallet,
            walletId,
            capabilities: p.capabilities,
            capabilityText: [p.name, ...p.capabilities, p.blurb].join(". "),
            blurb: p.blurb,
            chain: CHAIN,
          },
        );

        if (feedbackRows.length) {
          await tx.run(
            `
            MATCH (a:Agent {id: $agentId})
            UNWIND $rows AS row
            MERGE (e:Evidence {id: row.evid})
            SET e.type = 'reputation_event',
                e.event_kind = 'NewFeedback',
                e.source = 'erc8004',
                e.reference = row.evid,
                e.demo = true
            MERGE (e)-[:SUPPORTS]->(a)
            `,
            { agentId: p.id, rows: feedbackRows },
          );
        }

        await tx.run(
          `
          MATCH (a:Agent {id: $agentId})
          UNWIND $rows AS row
          MERGE (j:Job {id: row.jobId})
          SET j.job_id = row.jobKey,
              j.chain_id = $chain,
              j.last_event = row.outcome,
              j.tx_hash = row.tx,
              j.capability = $capability,
              j.description = $capability,
              j.demo = true
          MERGE (j)-[:PROVIDER]->(a)
          MERGE (o:Outcome {id: row.outcomeId})
          SET o.kind = row.outcome,
              o.job_id = row.jobKey,
              o.tx_hash = row.tx,
              o.demo = true
          MERGE (j)-[:HAS_OUTCOME]->(o)
          MERGE (ej:Evidence {id: row.jobEvid})
          SET ej.type = 'job_event',
              ej.source = 'erc8183',
              ej.reference = row.jobId,
              ej.event_kind = row.outcome,
              ej.demo = true
          MERGE (ej)-[:SUPPORTS]->(j)
          `,
          {
            agentId: p.id,
            chain: CHAIN,
            capability,
            rows: jobRows,
          },
        );

        if (payRows.length) {
          await tx.run(
            `
            MATCH (a:Agent {id: $agentId})-[:CONTROLS]->(w:Wallet)
            UNWIND $rows AS row
            MATCH (j:Job {id: row.jobId})
            MERGE (p:Payment {id: row.payId})
            SET p.tx_hash = row.tx,
                p.amount = row.amount,
                p.asset = 'USDC',
                p.demo = true
            MERGE (t:TransferEvent {id: row.xferId})
            SET t.tx_hash = row.tx,
                t.value = row.amount,
                t.from = '0xrequester00000000000000000000000000000001',
                t.to = $wallet,
                t.demo = true
            MERGE (p)-[:SETTLED_BY]->(t)
            MERGE (p)-[:FOR_JOB]->(j)
            MERGE (p)-[:TO_WALLET]->(w)
            MERGE (ep:Evidence {id: row.payEvid})
            SET ep.type = 'transfer',
                ep.source = 'arc:5042002',
                ep.reference = row.tx,
                ep.demo = true
            MERGE (ep)-[:SUPPORTS]->(p)
            `,
            { agentId: p.id, wallet: p.wallet, rows: payRows },
          );
        }
      });
    }

    // Embed outside the write txn (model download / inference can be slow).
    const { reindexProviderEmbeddings } = await import("../search/vector.js");
    const { indexed } = await reindexProviderEmbeddings();
    return {
      providers: DEMO_PROVIDERS.length,
      jobs: jobCount,
      embeddings: indexed,
    };
  } finally {
    await session.close();
  }
}


export const DEMO_SCENARIOS = [
  {
    id: "price-feeds-intent",
    label: "Price feeds · NL intent",
    blurb: "“reliable on-chain price feeds for trading agents” — no exact tag required.",
    filters: {
      query: "reliable on-chain price feeds for trading agents",
      minimum_verified_jobs: 10,
      minimum_completion_rate: 0.5,
      minimum_confidence: "low" as const,
    },
  },
  {
    id: "market-data-elite",
    label: "Market data · elite bar",
    blurb: "Semantic intent + ≥95% completion — who survives objective filters?",
    filters: {
      query: "market data oracle with high reliability",
      minimum_verified_jobs: 20,
      minimum_completion_rate: 0.95,
      minimum_confidence: "medium" as const,
    },
  },
  {
    id: "research-ops",
    label: "Research ops · NL",
    blurb: "“research reports and analysis agents” → HelixResearch.",
    filters: {
      query: "research reports and analysis for agent workflows",
      minimum_verified_jobs: 10,
      minimum_completion_rate: 0.9,
      minimum_confidence: "medium" as const,
    },
  },
];
