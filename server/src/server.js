import dns from 'dns';

// Fix for Node 18+ native fetch failing with "fetch failed" on some cloud providers due to broken IPv6
dns.setDefaultResultOrder('ipv4first');

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { ensureCollection } from './langchain/qdrantStore.js';
import { createApp } from './app.js';

/**
 * Boot sequence: MongoDB → Qdrant collection → HTTP server.
 * Embedding model loads lazily on first upload/chat.
 */
async function main() {
  await connectDB();

  // ── Diagnostic: test raw connectivity to Qdrant ──────────────────
  const qdrantTestUrl = `${env.qdrantUrl.replace(/\/$/, '')}/collections`;
  const hasKey = !!env.qdrantApiKey;
  console.log(`[qdrant-diag] URL: ${qdrantTestUrl}`);
  console.log(`[qdrant-diag] API key present: ${hasKey}, length: ${env.qdrantApiKey?.length ?? 0}`);
  try {
    const resp = await fetch(qdrantTestUrl, {
      headers: hasKey
        ? { 'api-key': env.qdrantApiKey, 'Authorization': `Bearer ${env.qdrantApiKey}` }
        : {},
    });
    const body = await resp.text();
    console.log(`[qdrant-diag] Status ${resp.status} — ${body.slice(0, 200)}`);
  } catch (diagErr) {
    console.error(`[qdrant-diag] ❌ Native fetch FAILED:`, diagErr.message);
    if (diagErr.cause) console.error(`[qdrant-diag]    cause:`, diagErr.cause);
  }
  // ────────────────────────────────────────────────────────────────

  try {
    await ensureCollection();
  } catch (err) {
    // Don't kill the API if Qdrant is briefly unreachable — uploads will
    // surface the error; retried on next call.
    console.error('[qdrant] init failed (continuing):', err.message);
    if (err.cause) console.error('[qdrant] cause:', err.cause);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] Listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Graceful shutdown — finish in-flight requests, then exit
  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Never crash on unexpected rejections — log and keep serving
  process.on('unhandledRejection', (err) => {
    console.error('[server] Unhandled rejection:', err);
  });
  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception:', err);
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
