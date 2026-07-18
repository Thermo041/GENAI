import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Pdf } from '../models/Pdf.js';
import { answerQuestion } from '../langchain/ragChain.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** How many previous messages to feed back into the prompt as history */
const HISTORY_WINDOW = 6;

/**
 * POST /api/chat — ask a question. Streams the answer via Server-Sent Events.
 * Body: { question, chatId?, pdfId? }
 *   - chatId absent → creates a new chat
 *   - pdfId  absent → search across all of the user's PDFs
 * SSE events: "token" (answer delta), "sources", "done", "error"
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { question, chatId, pdfId } = req.body;

  if (!question || !question.trim()) {
    throw ApiError.badRequest('Question is required');
  }
  if (question.length > 2000) {
    throw ApiError.badRequest('Question is too long (max 2000 characters)');
  }

  // Resolve or create the chat
  let chat;
  if (chatId) {
    chat = await Chat.findOne({ _id: chatId, user: req.user._id });
    if (!chat) throw ApiError.notFound('Chat not found');
  } else {
    let pdf = null;
    if (pdfId) {
      pdf = await Pdf.findOne({ _id: pdfId, user: req.user._id });
      if (!pdf) throw ApiError.notFound('PDF not found');
      if (pdf.status !== 'ready') {
        throw ApiError.badRequest('This PDF is still processing — try again shortly');
      }
    }
    chat = await Chat.create({
      user: req.user._id,
      pdf: pdf ? pdf._id : null,
      title: question.trim().slice(0, 60),
    });
  }

  // Pull recent history for conversational context
  const historyDocs = await Message.find({ chat: chat._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_WINDOW)
    .lean();
  const history = historyDocs.reverse().map(({ role, content }) => ({ role, content }));

  // Persist the user message
  await Message.create({ chat: chat._id, role: 'user', content: question.trim() });

  // Open the SSE stream
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send('meta', { chatId: chat._id, title: chat.title });

  try {
    const { answer, sources } = await answerQuestion({
      userId: req.user._id,
      pdfId: chat.pdf,
      question: question.trim(),
      history,
      onToken: (token) => send('token', { token }),
    });

    // Persist assistant reply + bump chat recency
    await Promise.all([
      Message.create({ chat: chat._id, role: 'assistant', content: answer, sources }),
      Chat.updateOne({ _id: chat._id }, { updatedAt: new Date() }),
    ]);

    send('sources', { sources });
    send('done', {});
  } catch (err) {
    console.error('[chat] RAG pipeline error:', err);
    send('error', { message: 'Failed to generate an answer. Please try again.' });
  } finally {
    res.end();
  }
});

/** GET /api/chat — list the user's chats (most recent first) */
export const listChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate('pdf', 'originalName status')
    .lean();
  res.json({ success: true, chats });
});

/** GET /api/chat/:id — a chat with all of its messages */
export const getChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id })
    .populate('pdf', 'originalName status')
    .lean();
  if (!chat) throw ApiError.notFound('Chat not found');

  const messages = await Message.find({ chat: chat._id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, chat, messages });
});

/** PATCH /api/chat/:id — rename */
export const renameChat = asyncHandler(async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) throw ApiError.badRequest('Title is required');
  if (title.length > 120) throw ApiError.badRequest('Title too long (max 120 characters)');

  const chat = await Chat.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { title },
    { new: true }
  );
  if (!chat) throw ApiError.notFound('Chat not found');
  res.json({ success: true, chat });
});

/** DELETE /api/chat/:id — delete chat + its messages */
export const deleteChat = asyncHandler(async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id });
  if (!chat) throw ApiError.notFound('Chat not found');

  await Promise.all([Message.deleteMany({ chat: chat._id }), chat.deleteOne()]);
  res.json({ success: true, message: 'Chat deleted' });
});
