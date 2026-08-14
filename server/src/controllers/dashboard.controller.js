import * as dashboardService from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminDashboard = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getAdminDashboard();
  res.json({ success: true, data });
});

export const employeeDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getEmployeeDashboard(req.user);
  res.json({ success: true, data });
});
