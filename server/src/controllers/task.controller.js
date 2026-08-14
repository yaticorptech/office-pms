import * as taskService from '../services/task.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listTasks = asyncHandler(async (req, res) => {
  const { data, meta } = await taskService.listTasks(req.validatedQuery, req.user);
  res.json({ success: true, data, meta });
});

export const getTask = asyncHandler(async (req, res) => {
  const data = await taskService.getTaskById(req.params.id, req.user);
  res.json({ success: true, data });
});

export const createTask = asyncHandler(async (req, res) => {
  const data = await taskService.createTask(req.body, req.user);
  res.status(201).json({ success: true, message: 'Task assigned successfully', data });
});

export const updateTask = asyncHandler(async (req, res) => {
  const data = await taskService.updateTask(req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Task updated successfully', data });
});

export const updateTaskStatus = asyncHandler(async (req, res) => {
  const data = await taskService.updateTaskStatus(req.params.id, req.body.status, req.user);
  const message =
    data.status === 'completed' ? 'Task marked as completed.' : 'Task status updated.';
  res.json({ success: true, message, data });
});

export const deleteTask = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  res.json({ success: true, message: 'Task deleted successfully' });
});
