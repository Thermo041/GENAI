import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // null → chat across all of the user's PDFs
    pdf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pdf',
      default: null,
    },
    title: {
      type: String,
      default: 'New Chat',
      trim: true,
      maxlength: 120,
    },
  },
  { timestamps: true }
);

chatSchema.index({ user: 1, updatedAt: -1 });

export const Chat = mongoose.model('Chat', chatSchema);
