import mongoose from 'mongoose';

const pdfSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    filename: {
      type: String, // stored (sanitized, unique) name
      required: true,
    },
    originalName: {
      type: String, // name as uploaded by the user
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    size: {
      type: Number, // bytes
      required: true,
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
      index: true,
    },
    processingError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Text search over names for the dashboard search box
pdfSchema.index({ user: 1, originalName: 1 });

export const Pdf = mongoose.model('Pdf', pdfSchema);
