import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Multer configured for in-memory PDF uploads.
 * Validates both the MIME type and the .pdf extension; the buffer is
 * additionally checked for the %PDF magic bytes in the controller.
 */
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdfMime || !isPdfExt) {
    return cb(ApiError.badRequest('Only PDF files are allowed'));
  }
  cb(null, true);
}

export const uploadPdf = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
}).single('file');
