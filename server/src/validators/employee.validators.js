import { z } from 'zod';
import { DEPARTMENTS, USER_ROLES, USER_STATUSES } from '../config/constants.js';
import { emailSchema, optionalFilter, paginationQuery, passwordSchema } from './common.js';

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: emailSchema,
  password: passwordSchema,
  department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Select a department' }) }),
  role: z.enum(USER_ROLES).default('employee'),
  profilePhoto: z.string().trim().max(500).optional().default(''),
  status: z.enum(USER_STATUSES).default('active'),
});

export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    department: z.enum(DEPARTMENTS).optional(),
    role: z.enum(USER_ROLES).optional(),
    profilePhoto: z.string().trim().max(500).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No changes were provided' });

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(USER_STATUSES, { errorMap: () => ({ message: 'Status must be active or inactive' }) }),
});

export const listEmployeesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  department: optionalFilter(z.enum(DEPARTMENTS)),
  status: optionalFilter(z.enum(USER_STATUSES)),
  role: optionalFilter(z.enum(USER_ROLES)),
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt']).optional(),
  ...paginationQuery,
});
