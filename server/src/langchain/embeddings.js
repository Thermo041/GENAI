import { Embeddings } from '@langchain/core/embeddings';
import { env } from '../config/env.js';

/**
 * Hugging Face embeddings running locally via @huggingface/transformers
 * (ONNX runtime). No HF API key required — the model is downloaded once
 * and cached on disk. Default model: Xenova/bge-small-en-v1.5 (384 dims,
 * the ONNX build of BAAI/bge-small-en-v1.5).
 */
let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      console.log(`[embeddings] Loading model ${env.embeddingModel}...`);
      const extractor = await pipeline('feature-extraction', env.embeddingModel, {
        dtype: 'q8', // quantized — fast on CPU, ideal for Render
      });
      console.log('[embeddings] Model ready');
      return extractor;
    })();
  }
  return extractorPromise;
}

// BGE models are trained with an instruction prefix for queries only.
const isBge = env.embeddingModel.toLowerCase().includes('bge');
const QUERY_PREFIX = isBge
  ? 'Represent this sentence for searching relevant passages: '
  : '';

export class HuggingFaceEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  /** Embed document chunks in small batches to bound memory usage. */
  async embedDocuments(texts) {
    const extractor = await getExtractor();
    const results = [];
    const BATCH = 16;
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const output = await extractor(batch, {
        pooling: isBge ? 'cls' : 'mean',
        normalize: true,
      });
      results.push(...output.tolist());
    }
    return results;
  }

  async embedQuery(text) {
    const extractor = await getExtractor();
    const output = await extractor(QUERY_PREFIX + text, {
      pooling: isBge ? 'cls' : 'mean',
      normalize: true,
    });
    return output.tolist()[0];
  }
}

export const embeddings = new HuggingFaceEmbeddings();

/** Vector size for the configured model (both suggested models are 384-dim). */
export const EMBEDDING_DIM = 384;
