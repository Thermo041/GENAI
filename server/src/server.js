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

  try {
    await ensureCollection();
  } catch (err) {
    // Don't kill the API if Qdrant is briefly unreachable — uploads will
    // surface the error; retried on next call.
    console.error('[qdrant] init failed (continuing):', err.message);
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
