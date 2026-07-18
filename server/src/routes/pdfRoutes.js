import { Router } from 'express';
import { uploadPdfFile, listPdfs, getPdf, deletePdf } from '../controllers/pdfController.js';
import { protect } from '../middleware/auth.js';
import { uploadPdf } from '../middleware/upload.js';

const router = Router();

router.use(protect);

router.post('/upload', uploadPdf, uploadPdfFile);
router.get('/', listPdfs);
router.get('/:id', getPdf);
router.delete('/:id', deletePdf);

export default router;
