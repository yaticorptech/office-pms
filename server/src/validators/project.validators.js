import { z } from 'zod';
import { PROJECT_STATUSES, PROJECT_TYPES } from '../config/constants.js';
import {
  objectId,
  optionalDate,
  optionalEnum,
  optionalFilter,
  paginationQuery,
  requiredDate,
} from './common.js';

/** End date, when supplied, must not fall before the start date. */
const endAfterStart = (data) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate.getTime() >= data.startDate.getTime();
};

const dateRangeIssue = { message: 'End date cannot be before the start date', path: ['endDate'] };

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2, 'Project name is required').max(120),
    // Optional — an untyped project is saved with `type: null`.
    type: optionalEnum(PROJECT_TYPES, 'Select a valid project type'),
    description: z.string().trim().max(2000).optional().default(''),
    owner: objectId.describe('Project owner is required'),
    startDate: requiredDate,
    endDate: optionalDate,
    status: z.enum(PROJECT_STATUSES).default('planning'),
  })
  .refine(endAfterStart, dateRangeIssue);

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2, 'Project name is required').max(120).optional(),
    type: optionalEnum(PROJECT_TYPES, 'Select a valid project type'),
    description: z.string().trim().max(2000).optional(),
    owner: objectId.optional(),
    startDate: requiredDate.optional(),
    endDate: optionalDate,
    status: z.enum(PROJECT_STATUSES).optional(),
  })
  .refine(endAfterStart, dateRangeIssue);

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  type: optionalFilter(z.enum(PROJECT_TYPES)),
  status: optionalFilter(z.enum(PROJECT_STATUSES)),
  owner: optionalFilter(objectId),
  sort: z
    .enum(['name', '-name', 'createdAt', '-createdAt', 'endDate', '-endDate'])
    .optional(),
  ...paginationQuery,
});
