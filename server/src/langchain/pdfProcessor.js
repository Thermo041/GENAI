import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { env } from '../config/env.js';

/**
 * PDF text extraction + cleaning + semantic chunking.
 * Uses unpdf (serverless build of Mozilla pdf.js) per page so every
 * chunk keeps its page number.
 */

/** Collapse whitespace and strip control characters. */
function cleanText(text) {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +\n/g, '\n')
    .trim();
}

/**
 * Extract text per page from a PDF buffer.
 * @returns {Promise<{pages: Array<{pageNumber: number, text: string}>, pageCount: number}>}
 */
export async function extractPages(buffer) {
  const { extractText, getDocumentProxy } = await import('unpdf');

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text: pageTexts } = await extractText(pdf, { mergePages: false });

  const pages = pageTexts.map((text, i) => ({
    pageNumber: i + 1,
    text: cleanText(text || ''),
  }));

  return { pages: pages.filter((p) => p.text.length > 0), pageCount: totalPages };
}

/**
 * Split page texts into overlapping semantic chunks.
 * @returns {Promise<Array<{text: string, pageNumber: number, chunkIndex: number}>>}
 */
export async function chunkPages(pages) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: env.chunkSize,
    chunkOverlap: env.chunkOverlap,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  const chunks = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const parts = await splitter.splitText(page.text);
    for (const part of parts) {
      const text = part.trim();
      if (text.length < 20) continue; // skip noise fragments
      chunks.push({ text, pageNumber: page.pageNumber, chunkIndex: chunkIndex++ });
    }
  }

  return chunks;
}
