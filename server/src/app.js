import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

export function createApp() {
  const app = express();

  // Behind Render's proxy — needed for correct client IPs (rate limiting)
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS — allow the deployed client and local dev
  app.use(
    cors({
      origin: [env.clientUrl, 'http://localhost:5173'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Health check for Render
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/pdf', pdfRoutes);
  app.use('/api/chat', chatRoutes);

  // In production, serve the built React client (single Render service).
  // The 404/error handlers still apply to /api/* routes.
  if (env.isProduction) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get(/^(?!\/api\/).*/, (_req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
