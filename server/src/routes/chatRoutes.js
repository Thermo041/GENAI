import { Router } from 'express';
import {
  sendMessage,
  listChats,
  getChat,
  renameChat,
  deleteChat,
} from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(protect);

router.post('/', chatLimiter, sendMessage);
router.get('/', listChats);
router.get('/:id', getChat);
router.patch('/:id', renameChat);
router.delete('/:id', deleteChat);

export default router;
