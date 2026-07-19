import express from 'express';
import { authenticate } from '../middleware/auth';
import { getWheelStatus, spinWheel } from '../controllers/wheelController';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

router.get('/status', authenticate, asyncHandler(getWheelStatus));
router.post('/spin', authenticate, asyncHandler(spinWheel));

export default router;
