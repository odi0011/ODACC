import express from 'express';
import { sendCode, register, login, refreshToken, logout } from '../../controllers/auth/authController.js';
import { ipRateLimit } from '../../middleware/rateLimit.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = express.Router();

router.post('/code', ipRateLimit({ windowSec: 60, maxRequests: 10 }), sendCode);

router.post('/register', register);
router.post('/login', ipRateLimit({ windowSec: 60, maxRequests: 10 }), login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authMiddleware, logout);

export default router;
