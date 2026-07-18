import { Pdf } from '../models/Pdf.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { uploadToS3, deleteFromS3 } from '../services/s3Service.js';
import { processPdf } from '../services/pdfIngestService.js';
import { deletePdfVectors } from '../langchain/qdrantStore.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** POST /api/pdf/upload — multipart/form-data with a "file" field */
export const uploadPdfFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded — attach a PDF in the "file" field');
  }

  // Defense in depth: verify the PDF magic bytes, not just MIME/extension
  if (!req.file.buffer.subarray(0, 5).toString().startsWith('%PDF')) {
    throw ApiError.badRequest('File is not a valid PDF');
  }

  const { originalname, buffer, size } = req.file;

  // 1) Store the binary in S3
  const s3Key = await uploadToS3({
    userId: req.user._id,
    originalName: originalname,
    buffer,
  });

  // 2) Store only metadata in MongoDB
  const pdf = await Pdf.create({
    user: req.user._id,
    filename: s3Key.split('/').pop(),
    originalName: originalname,
    s3Key,
    size,
    status: 'processing',
  });

  // 3) Extract → chunk → embed → index in the background so the
  //    request returns immediately; the UI polls the status field.
  processPdf({
    pdfId: pdf._id,
    userId: req.user._id,
    filename: originalname,
    buffer,
  });

  res.status(201).json({ success: true, pdf });
});

/** GET /api/pdf?search=&page=&limit= — paginated list with search */
export const listPdfs = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
  const search = (req.query.search || '').trim();

  const query = { user: req.user._id };
  if (search) {
    query.originalName = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const [pdfs, total] = await Promise.all([
    Pdf.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Pdf.countDocuments(query),
  ]);

  res.json({
    success: true,
    pdfs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/** GET /api/pdf/:id */
export const getPdf = asyncHandler(async (req, res) => {
  const pdf = await Pdf.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!pdf) throw ApiError.notFound('PDF not found');
  res.json({ success: true, pdf });
});

/** DELETE /api/pdf/:id — removes S3 object, vectors, chats and metadata */
export const deletePdf = asyncHandler(async (req, res) => {
  const pdf = await Pdf.findOne({ _id: req.params.id, user: req.user._id });
  if (!pdf) throw ApiError.notFound('PDF not found');

  // Clean up in parallel: S3 object + Qdrant vectors + chats tied to this PDF
  const chatIds = await Chat.find({ pdf: pdf._id }).distinct('_id');
  await Promise.all([
    deleteFromS3(pdf.s3Key).catch((e) => console.error('[s3] delete failed:', e.message)),
    deletePdfVectors({ userId: req.user._id, pdfId: pdf._id }).catch((e) =>
      console.error('[qdrant] delete failed:', e.message)
    ),
    Message.deleteMany({ chat: { $in: chatIds } }),
    Chat.deleteMany({ _id: { $in: chatIds } }),
  ]);

  await pdf.deleteOne();
  res.json({ success: true, message: 'PDF deleted' });
});
