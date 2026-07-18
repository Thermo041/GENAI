import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { embeddings, EMBEDDING_DIM } from './embeddings.js';

/**
 * Thin Qdrant REST-API wrapper using native fetch.
 * Replaces @qdrant/js-client-rest to avoid undici version conflicts
 * on cloud platforms like Render (Node 18 built-in undici vs npm undici).
 *
 * One collection for all users, isolated per-user (and optionally per-PDF)
 * via payload filters.
 */

const QDRANT_BASE = env.qdrantUrl.replace(/\/$/, '');

/** Shared headers for every Qdrant request. */
function qdrantHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (env.qdrantApiKey) h['api-key'] = env.qdrantApiKey;
  return h;
}

/** Low-level helper — throws on non-2xx responses. */
async function qdrantFetch(path, options = {}) {
  const url = `${QDRANT_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...qdrantHeaders(), ...(options.headers || {}) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Qdrant ${options.method || 'GET'} ${path} → ${res.status}: ${body}`);
  }

  return res.json();
}

/** Create the collection + payload indexes on boot if they don't exist. */
export async function ensureCollection() {
  const data = await qdrantFetch('/collections');
  const exists = data.result.collections.some((c) => c.name === env.qdrantCollection);

  if (!exists) {
    await qdrantFetch(`/collections/${env.qdrantCollection}`, {
      method: 'PUT',
      body: JSON.stringify({
        vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
      }),
    });

    // Indexes make filtered search (by user / pdf) fast
    await qdrantFetch(`/collections/${env.qdrantCollection}/index`, {
      method: 'PUT',
      body: JSON.stringify({ field_name: 'userId', field_schema: 'keyword' }),
    });
    await qdrantFetch(`/collections/${env.qdrantCollection}/index`, {
      method: 'PUT',
      body: JSON.stringify({ field_name: 'pdfId', field_schema: 'keyword' }),
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

    await qdrantFetch(`/collections/${env.qdrantCollection}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    });
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

  const data = await qdrantFetch(`/collections/${env.qdrantCollection}/points/search`, {
    method: 'POST',
    body: JSON.stringify({
      vector,
      limit: topK,
      filter: { must },
      with_payload: true,
    }),
  });

  return data.result.map((r) => ({
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
  await qdrantFetch(`/collections/${env.qdrantCollection}/points/delete?wait=true`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        must: [
          { key: 'userId', match: { value: String(userId) } },
          { key: 'pdfId', match: { value: String(pdfId) } },
        ],
      },
    }),
  });
}
