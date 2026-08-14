import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from '../validators/employee.validators.js';

const router = Router();

router.use(requireAuth);

// Any signed-in user may read the assignable list (it powers dropdowns), but it
// exposes nothing beyond name, email and department.
router.get('/assignable', employeeController.listAssignable);

router.use(requireAdmin);

router.get('/', validate(listEmployeesQuerySchema, 'query'), employeeController.listEmployees);
router.post('/', validate(createEmployeeSchema), employeeController.createEmployee);
router.get('/:id', validate(idParams, 'params'), employeeController.getEmployee);
router.put(
  '/:id',
  validate(idParams, 'params'),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee,
);
router.patch(
  '/:id/status',
  validate(idParams, 'params'),
  validate(updateEmployeeStatusSchema),
  employeeController.setEmployeeStatus,
);

export default router;
