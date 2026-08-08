/** Thin embeddings interface — local Xenova today; OpenAI can plug in later. */

export interface Embeddings {
  readonly dimensions: number;
  readonly modelId: string;
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_DIMS = 384;
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractionPipeline = (
  text: string,
  opts?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return (await pipeline("feature-extraction", EMBEDDING_MODEL)) as FeatureExtractionPipeline;
    })();
  }
  return pipelinePromise;
}

function toArray(data: Float32Array | number[]): number[] {
  return Array.from(data);
}

export class LocalMiniLMEmbeddings implements Embeddings {
  readonly dimensions = EMBEDDING_DIMS;
  readonly modelId = EMBEDDING_MODEL;

  async embed(text: string): Promise<number[]> {
    const extractor = await getPipeline();
    const out = await extractor(text.slice(0, 2000), {
      pooling: "mean",
      normalize: true,
    });
    return toArray(out.data);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) {
      out.push(await this.embed(t));
    }
    return out;
  }
}

let singleton: Embeddings | null = null;

export function getEmbeddings(): Embeddings {
  if (!singleton) {
    singleton = new LocalMiniLMEmbeddings();
  }
  return singleton;
}

export function capabilityText(input: {
  capabilities?: string[];
  capability?: string | null;
  blurb?: string | null;
  display_name?: string | null;
  job_capabilities?: string[];
}): string {
  const parts = [
    input.display_name ?? "",
    ...(input.capabilities ?? []),
    input.capability ?? "",
    input.blurb ?? "",
    ...(input.job_capabilities ?? []),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  return [...new Set(parts)].join(". ");
}
