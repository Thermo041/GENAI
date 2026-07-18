import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connect to MongoDB Atlas with sensible production defaults.
 * Retries are handled by the mongoose driver's built-in reconnect logic.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
}
