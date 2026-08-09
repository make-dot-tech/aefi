import { chainId, getDriver } from "../graph/queries.js";
import {
  capabilityText,
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  getEmbeddings,
} from "./embeddings.js";

export const VECTOR_INDEX = "agent_capability_embedding";

export async function ensureVectorIndex(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `
      CREATE VECTOR INDEX ${VECTOR_INDEX} IF NOT EXISTS
      FOR (a:Agent) ON (a.embedding)
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: 384,
          \`vector.similarity_function\`: 'cosine'
        }
      }
      `,
    );
  } finally {
    await session.close();
  }
}

export async function embedAndStoreAgent(
  agentId: string,
  text: string,
): Promise<void> {
  const embedding = await getEmbeddings().embed(text);
  const session = getDriver().session();
  try {
    await session.run(
      `
      MATCH (a:Agent {id: $id})
      SET a.capability_text = $text,
          a.embedding = $embedding,
          a.embedding_model = $model,
          a.embedding_dims = $dims
      `,
      {
        id: agentId,
        text,
        embedding,
        model: EMBEDDING_MODEL,
        dims: EMBEDDING_DIMS,
      },
    );
  } finally {
    await session.close();
  }
}

/** Re-embed all agents that have capability / blurb / capabilities props. */
export async function reindexProviderEmbeddings(): Promise<{
  indexed: number;
}> {
  await ensureVectorIndex();
  const session = getDriver().session();
  try {
    const res = await session.run(
      `
      MATCH (a:Agent)
      WHERE (a.capabilities IS NOT NULL OR a.capability IS NOT NULL OR a.blurb IS NOT NULL OR a.capability_text IS NOT NULL)
        AND (a.chain_id IS NULL OR toString(a.chain_id) = $chainId)
      OPTIONAL MATCH (j:Job)-[:PROVIDER]->(a)
      WITH a, collect(DISTINCT j.capability) AS jobCaps
      RETURN a.id AS id,
             a.display_name AS display_name,
             a.capabilities AS capabilities,
             a.capability AS capability,
             a.blurb AS blurb,
             a.capability_text AS capability_text,
             [c IN jobCaps WHERE c IS NOT NULL] AS job_capabilities
      `,
      { chainId: chainId() },
    );

    let indexed = 0;
    for (const rec of res.records) {
      const id = String(rec.get("id"));
      const existing = rec.get("capability_text");
      const text =
        typeof existing === "string" && existing.trim()
          ? existing
          : capabilityText({
              display_name: rec.get("display_name")
                ? String(rec.get("display_name"))
                : null,
              capabilities: Array.isArray(rec.get("capabilities"))
                ? rec.get("capabilities").map(String)
                : undefined,
              capability: rec.get("capability")
                ? String(rec.get("capability"))
                : null,
              blurb: rec.get("blurb") ? String(rec.get("blurb")) : null,
              job_capabilities: Array.isArray(rec.get("job_capabilities"))
                ? rec.get("job_capabilities").map(String)
                : undefined,
            });
      if (!text.trim()) continue;
      await embedAndStoreAgent(id, text);
      indexed += 1;
    }
    return { indexed };
  } finally {
    await session.close();
  }
}

export async function vectorRecallProviders(
  queryEmbedding: number[],
  topK: number,
): Promise<Array<{ provider_id: string; semantic_similarity: number }>> {
  const session = getDriver().session();
  try {
    await ensureVectorIndex();
    const res = await session.run(
      `
      CALL db.index.vector.queryNodes($index, $k, $embedding)
      YIELD node, score
      WHERE node:Agent
        AND (node.chain_id IS NULL OR toString(node.chain_id) = $chainId)
      RETURN node.id AS id, score AS score
      `,
      {
        index: VECTOR_INDEX,
        k: Math.max(1, Math.min(topK, 50)),
        embedding: queryEmbedding,
        chainId: chainId(),
      },
    );
    return res.records.map((r) => ({
      provider_id: String(r.get("id")),
      semantic_similarity: Number(r.get("score") ?? 0),
    }));
  } finally {
    await session.close();
  }
}
