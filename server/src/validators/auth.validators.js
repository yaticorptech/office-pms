import { z } from 'zod';
import { DEPARTMENTS, USER_ROLES } from '../config/constants.js';
import { emailSchema, passwordSchema } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: emailSchema,
  password: passwordSchema,
  department: z.enum(DEPARTMENTS).optional(),
  role: z.enum(USER_ROLES).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
  profilePhoto: z.string().trim().max(500).optional(),
});
