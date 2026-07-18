import { Pdf } from '../models/Pdf.js';
import { extractPages, chunkPages } from '../langchain/pdfProcessor.js';
import { upsertChunks } from '../langchain/qdrantStore.js';

/**
 * Ingestion pipeline (runs after the S3 upload + metadata insert):
 *   extract text → clean → chunk → embed → store vectors in Qdrant.
 * Runs in the background; PDF status tracks progress for the UI.
 */
export async function processPdf({ pdfId, userId, filename, buffer }) {
  try {
    const { pages, pageCount } = await extractPages(buffer);
    if (pages.length === 0) {
      throw new Error('No extractable text found in this PDF (it may be scanned images)');
    }

    const chunks = await chunkPages(pages);
    if (chunks.length === 0) {
      throw new Error('PDF text was too sparse to index');
    }

    const chunkCount = await upsertChunks({ userId, pdfId, filename, chunks });

    await Pdf.findByIdAndUpdate(pdfId, {
      status: 'ready',
      pageCount,
      chunkCount,
      processingError: null,
    });
    console.log(`[pdf] Indexed "${filename}" — ${pageCount} pages, ${chunkCount} chunks`);
  } catch (err) {
    console.error(`[pdf] Processing failed for "${filename}":`, err.message);
    await Pdf.findByIdAndUpdate(pdfId, {
      status: 'failed',
      processingError: err.message,
    }).catch(() => {});
  }
}
