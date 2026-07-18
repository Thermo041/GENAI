import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { env } from '../config/env.js';
import { similaritySearch } from './qdrantStore.js';

/**
 * RAG chain: question → embed → Qdrant search → context → Groq → answer.
 * Strictly grounded: the model is instructed to answer ONLY from context.
 */

export const NO_ANSWER_MESSAGE =
  "I couldn't find that information in your uploaded documents.";

const SYSTEM_PROMPT = `You are DocuChat, a friendly and precise assistant for the user's uploaded PDF documents.

There are two kinds of messages — treat them differently:

1. Casual conversation (greetings like "hi"/"hello", thanks, "who are you", "what can you do", goodbyes):
   - Respond naturally, warmly and briefly. Do NOT use the document context for these.
   - If helpful, mention that you can answer questions about their uploaded PDFs.
   - Example: "Hi! 👋 I'm ready to answer questions about your uploaded documents. What would you like to know?"

2. Questions seeking information or facts:
   - Answer ONLY from the provided document context. Never use outside knowledge.
   - Never invent, assume, or extrapolate facts that are not in the context.
   - If the context does not contain the answer, reply exactly: "${NO_ANSWER_MESSAGE}"
   - Keep answers concise and accurate.
   - Format responses in Markdown (lists, bold, code blocks where appropriate).
   - When useful, mention the source like (filename, page N).`;

const prompt = ChatPromptTemplate.fromMessages([
  ['system', SYSTEM_PROMPT],
  [
    'human',
    `Context from the documents:
---------------------
{context}
---------------------

Recent conversation:
{history}

Question: {question}`,
  ],
]);

const llm = new ChatGroq({
  apiKey: env.groqApiKey,
  model: env.groqModel,
  temperature: 0.1, // low temperature → factual, grounded answers
  maxTokens: 1024,
});

const chain = prompt.pipe(llm).pipe(new StringOutputParser());

function formatContext(chunks) {
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (file: ${c.filename}, page: ${c.pageNumber})\n${c.text}`
    )
    .join('\n\n');
}

function formatHistory(messages) {
  if (!messages?.length) return '(no previous messages)';
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
}

/**
 * Lightweight small-talk detector: greetings, thanks, capability questions.
 * These skip retrieval entirely — no context, no source citations.
 */
const SMALL_TALK_RE =
  /^(hi+|hii+|hello+|hey+|yo|hola|namaste|good\s*(morning|afternoon|evening|night)|how\s*are\s*you\??|what'?s\s*up\??|sup|thanks?( you| u)?!*|thank\s*you!*|ty|ok(ay)?|cool|nice|great|bye+|goodbye|see\s*ya|who\s*are\s*you\??|what\s*can\s*you\s*do\??|help)[\s!.?,🙂😊👋]*$/i;

export function isSmallTalk(text) {
  return SMALL_TALK_RE.test(text.trim());
}

/**
 * Run the full RAG pipeline, streaming tokens via onToken.
 * @returns {Promise<{answer: string, sources: Array}>}
 */
export async function answerQuestion({ userId, pdfId, question, history = [], onToken }) {
  // 0) Small talk → skip retrieval, let the LLM reply conversationally
  if (isSmallTalk(question)) {
    const input = {
      context: '(no document context needed — this is casual conversation)',
      history: formatHistory(history),
      question,
    };
    let answer = '';
    const stream = await chain.stream(input);
    for await (const token of stream) {
      answer += token;
      if (onToken) onToken(token);
    }
    return { answer, sources: [] };
  }

  // 1) Retrieve top-K relevant chunks (embedding + similarity search)
  const chunks = await similaritySearch({ userId, pdfId, query: question });

  // 2) No context at all → grounded "not found" without calling the LLM
  if (chunks.length === 0) {
    if (onToken) onToken(NO_ANSWER_MESSAGE);
    return { answer: NO_ANSWER_MESSAGE, sources: [] };
  }

  // 3) Generate with Groq, streaming tokens to the caller
  const input = {
    context: formatContext(chunks),
    history: formatHistory(history),
    question,
  };

  let answer = '';
  const stream = await chain.stream(input);
  for await (const token of stream) {
    answer += token;
    if (onToken) onToken(token);
  }

  // 4) Deduplicated sources (per file+page) for citation display
  const seen = new Set();
  const sources = [];
  for (const c of chunks) {
    const key = `${c.pdfId}:${c.pageNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      pdfId: c.pdfId,
      filename: c.filename,
      pageNumber: c.pageNumber,
      score: Number(c.score?.toFixed(4)),
    });
  }

  return { answer, sources };
}
