import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { embeddings, EMBEDDING_DIM } from './embeddings.js';

/**
 * Thin service around Qdrant Cloud: one collection for all users,
 * isolated per-user (and optionally per-PDF) via payload filters.
 */
// Render's free tier blocks outbound connections to non-standard ports (like 6333).
// Qdrant Cloud listens on port 443 too, so force HTTPS to use 443 instead of
// the library's default 6333.
const parsedUrl = new URL(env.qdrantUrl);
const qdrantPort = parsedUrl.port
  ? parseInt(parsedUrl.port, 10)
  : parsedUrl.protocol === 'https:' ? 443 : 6333;

export const qdrant = new QdrantClient({
  url: env.qdrantUrl,
  apiKey: env.qdrantApiKey,
  port: qdrantPort,
});

/** Create the collection + payload indexes on boot if they don't exist. */
export async function ensureCollection() {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === env.qdrantCollection);

  if (!exists) {
    await qdrant.createCollection(env.qdrantCollection, {
      vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
    });
    // Indexes make filtered search (by user / pdf) fast
    await qdrant.createPayloadIndex(env.qdrantCollection, {
      field_name: 'userId',
      field_schema: 'keyword',
    });
    await qdrant.createPayloadIndex(env.qdrantCollection, {
      field_name: 'pdfId',
      field_schema: 'keyword',
    });
    console.log(`[qdrant] Created collection "${env.qdrantCollection}"`);
  } else {
    console.log(`[qdrant] Collection "${env.qdrantCollection}" ready`);
  }
}

/**
 * Embed chunks and upsert them with metadata.
 * @param {Array<{text: string, pageNumber: number, chunkIndex: number}>} chunks
 */
export async function upsertChunks({ userId, pdfId, filename, chunks }) {
  const vectors = await embeddings.embedDocuments(chunks.map((c) => c.text));

  // Upsert in batches to stay under request size limits
  const BATCH = 64;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const points = chunks.slice(i, i + BATCH).map((chunk, j) => ({
      id: randomUUID(),
      vector: vectors[i + j],
      payload: {
        userId: String(userId),
        pdfId: String(pdfId),
        filename,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      },
    }));
    await qdrant.upsert(env.qdrantCollection, { wait: true, points });
  }
  return chunks.length;
}

/**
 * Similarity search scoped to a user, optionally to a single PDF.
 * Returns top-K chunks with their metadata and scores.
 */
export async function similaritySearch({ userId, pdfId = null, query, topK = env.topK }) {
  const vector = await embeddings.embedQuery(query);

  const must = [{ key: 'userId', match: { value: String(userId) } }];
  if (pdfId) {
    must.push({ key: 'pdfId', match: { value: String(pdfId) } });
  }

  const results = await qdrant.search(env.qdrantCollection, {
    vector,
    limit: topK,
    filter: { must },
    with_payload: true,
  });

  return results.map((r) => ({
    text: r.payload.text,
    filename: r.payload.filename,
    pdfId: r.payload.pdfId,
    pageNumber: r.payload.pageNumber,
    chunkIndex: r.payload.chunkIndex,
    score: r.score,
  }));
}

/** Delete every vector belonging to a PDF (called when the PDF is deleted). */
export async function deletePdfVectors({ userId, pdfId }) {
  await qdrant.delete(env.qdrantCollection, {
    wait: true,
    filter: {
      must: [
        { key: 'userId', match: { value: String(userId) } },
        { key: 'pdfId', match: { value: String(pdfId) } },
      ],
    },
  });
}
