import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/admin', requireAdmin, dashboardController.adminDashboard);
router.get('/employee', dashboardController.employeeDashboard);

export default router;
