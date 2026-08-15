import { Router } from 'express';
import mongoose from 'mongoose';
import {
  DEPARTMENT_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  ROLE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  USER_STATUS_OPTIONS,
} from '../config/constants.js';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import employeeRoutes from './employee.routes.js';
import notificationRoutes from './notification.routes.js';
import projectRoutes from './project.routes.js';
import taskRoutes from './task.routes.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * Reports the database too, and answers 503 when it is unreachable — a platform
 * health check must fail while the app cannot actually serve requests.
 */
router.get('/health', (_req, res) => {
  const state = mongoose.connection.readyState;
  const healthy = state === 1;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'ok' : 'degraded',
    database: DB_STATES[state] ?? 'unknown',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Serving the option lists from the API means adding a project type or department
 * later only requires a change in config/constants.js.
 */
router.get('/meta/options', (_req, res) => {
  res.json({
    success: true,
    data: {
      projectTypes: PROJECT_TYPE_OPTIONS,
      projectStatuses: PROJECT_STATUS_OPTIONS,
      departments: DEPARTMENT_OPTIONS,
      taskPriorities: TASK_PRIORITY_OPTIONS,
      taskStatuses: TASK_STATUS_OPTIONS,
      roles: ROLE_OPTIONS,
      userStatuses: USER_STATUS_OPTIONS,
    },
  });
});

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/employees', employeeRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
