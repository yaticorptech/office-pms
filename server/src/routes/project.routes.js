import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '../validators/project.validators.js';

const router = Router();

router.use(requireAuth);

// Reads are open to every signed-in user: employees need project context for
// their tasks. Writes are admin-only (business rules #7 and #8).
router.get('/options', projectController.listOptions);
router.get('/', validate(listProjectsQuerySchema, 'query'), projectController.listProjects);
router.get('/:id', validate(idParams, 'params'), projectController.getProject);
router.get('/:id/tasks', validate(idParams, 'params'), projectController.getProjectTasks);

router.post('/', requireAdmin, validate(createProjectSchema), projectController.createProject);
router.put(
  '/:id',
  requireAdmin,
  validate(idParams, 'params'),
  validate(updateProjectSchema),
  projectController.updateProject,
);
router.delete(
  '/:id',
  requireAdmin,
  validate(idParams, 'params'),
  projectController.archiveProject,
);

export default router;
