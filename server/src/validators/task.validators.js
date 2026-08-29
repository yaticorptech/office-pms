import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../config/constants.js';
import {
  booleanFlag,
  objectId,
  objectIdArray,
  optionalDate,
  optionalFilter,
  paginationQuery,
} from './common.js';

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Task title is required').max(160),
  description: z.string().trim().max(2000).optional().default(''),
  project: objectId.describe('Project is required'),
  assignedTo: objectIdArray('At least one assigned employee is required'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  status: z.enum(TASK_STATUSES).default('todo'),
  dueDate: optionalDate,
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2, 'Task title is required').max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    project: objectId.optional(),
    assignedTo: objectIdArray('At least one assigned employee is required').optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    dueDate: optionalDate,
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No changes were provided' });

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES, { errorMap: () => ({ message: 'Select a valid status' }) }),
});

export const listTasksQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  project: optionalFilter(objectId),
  assignedTo: optionalFilter(objectId),
  priority: optionalFilter(z.enum(TASK_PRIORITIES)),
  status: optionalFilter(z.enum(TASK_STATUSES)),
  overdue: booleanFlag,
  mine: booleanFlag,
  selfAssigned: booleanFlag,
  sort: z
    .enum(['dueDate', '-dueDate', 'createdAt', '-createdAt', 'priority', '-priority', 'title', '-title'])
    .optional(),
  ...paginationQuery,
});
