import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    // Retrieval sources attached to assistant messages
    sources: [
      {
        pdfId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pdf' },
        filename: String,
        pageNumber: Number,
        score: Number,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
