import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js';

const router = Router();

// Credential endpoints are rate limited: they are the ones worth guessing at.
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Public only while the database has no users (first-admin bootstrap);
// afterwards the service requires an authenticated admin.
router.post('/register', authLimiter, optionalAuth, validate(registerSchema), authController.register);

router.get('/me', requireAuth, authController.me);
router.put('/me', requireAuth, validate(updateProfileSchema), authController.updateProfile);
router.post(
  '/change-password',
  authLimiter,
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword,
);

export default router;
