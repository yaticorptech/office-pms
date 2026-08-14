import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/task.validators.js';

const router = Router();

router.use(requireAuth);

// The service scopes list/read results to the caller when they are not an admin.
router.get('/', validate(listTasksQuerySchema, 'query'), taskController.listTasks);
router.get('/:id', validate(idParams, 'params'), taskController.getTask);

// Employees change status only (their own tasks); everything else is admin-only.
router.patch(
  '/:id/status',
  validate(idParams, 'params'),
  validate(updateTaskStatusSchema),
  taskController.updateTaskStatus,
);

router.post('/', requireAdmin, validate(createTaskSchema), taskController.createTask);
router.put(
  '/:id',
  requireAdmin,
  validate(idParams, 'params'),
  validate(updateTaskSchema),
  taskController.updateTask,
);
router.delete('/:id', requireAdmin, validate(idParams, 'params'), taskController.deleteTask);

export default router;
