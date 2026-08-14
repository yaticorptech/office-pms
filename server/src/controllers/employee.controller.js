import * as employeeService from '../services/employee.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listEmployees = asyncHandler(async (req, res) => {
  const { data, meta } = await employeeService.listEmployees(req.validatedQuery);
  res.json({ success: true, data, meta });
});

export const listAssignable = asyncHandler(async (_req, res) => {
  const data = await employeeService.listAssignableEmployees();
  res.json({ success: true, data });
});

export const getEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.getEmployeeById(req.params.id);
  res.json({ success: true, data });
});

export const createEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.createEmployee(req.body);
  res.status(201).json({ success: true, message: 'Employee added successfully', data });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.updateEmployee(req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Employee updated successfully', data });
});

export const setEmployeeStatus = asyncHandler(async (req, res) => {
  const data = await employeeService.setEmployeeStatus(req.params.id, req.body.status, req.user);
  const message = data.status === 'active' ? 'Employee activated' : 'Employee deactivated';
  res.json({ success: true, message, data });
});
