import { closeDriver, getDriver } from "../graph/queries.js";
import { loadNeo4jConfig } from "../lib/config.js";
import { reindexProviderEmbeddings } from "../search/vector.js";

async function main() {
  loadNeo4jConfig();
  await getDriver().verifyConnectivity();
  console.log("Embedding providers (first run may download the MiniLM model)…");
  const { indexed } = await reindexProviderEmbeddings();
  console.log(`Indexed embeddings for ${indexed} agent(s)`);
  await closeDriver();
}

main().catch(async (err) => {
  console.error(err);
  await closeDriver().catch(() => undefined);
  process.exit(1);
});
