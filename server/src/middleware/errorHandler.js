import { env } from '../config/env.js';

/**
 * Centralized error handler — the last middleware in the chain.
 * Normalizes Mongoose/Multer/JWT errors into meaningful JSON responses.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // If a response is already streaming (SSE), we can't send JSON — just end it.
  if (res.headersSent) {
    console.error('[error] after headers sent:', err.message);
    return res.end();
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Mongoose: invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Mongoose: schema validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Mongo duplicate key (e.g. email already registered)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with that ${field} already exists`;
  }

  // Multer file-size limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = `File too large. Maximum size is ${env.maxFileSizeMb} MB`;
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
