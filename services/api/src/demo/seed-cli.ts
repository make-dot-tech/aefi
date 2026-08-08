import { loadNeo4jConfig } from "../lib/config.js";
import { closeDriver, getDriver } from "../graph/queries.js";
import { seedDemoProviders } from "./seed.js";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForNeo4j(attempts = 20): Promise<void> {
  loadNeo4jConfig();
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await getDriver().verifyConnectivity();
      return;
    } catch (err) {
      last = err;
      await closeDriver().catch(() => undefined);
      console.error(`Neo4j not ready (${i}/${attempts})…`);
      await sleep(1000);
    }
  }
  throw last instanceof Error ? last : new Error("Neo4j unavailable");
}

async function main() {
  await waitForNeo4j();
  const result = await seedDemoProviders();
  console.log(
    `Seeded demo providers=${result.providers} jobs=${result.jobs}` +
      (result.embeddings != null ? ` embeddings=${result.embeddings}` : ""),
  );
  await closeDriver();
}

main().catch(async (err) => {
  console.error(err);
  await closeDriver().catch(() => undefined);
  process.exit(1);
});
