// server/routes/auth.ts
import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { register, login, me, logout, requestPasswordReset, resetPassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Asegura cookies disponibles
router.use(cookieParser());

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);
router.post('/auth/logout', logout);

// Recovery
router.post('/auth/request-password-reset', requestPasswordReset);
router.post('/auth/reset-password', resetPassword);

export default router;
