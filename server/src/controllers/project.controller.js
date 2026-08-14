import * as projectService from '../services/project.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listProjects = asyncHandler(async (req, res) => {
  const { data, meta } = await projectService.listProjects(req.validatedQuery);
  res.json({ success: true, data, meta });
});

export const listOptions = asyncHandler(async (_req, res) => {
  const data = await projectService.listProjectOptions();
  res.json({ success: true, data });
});

export const getProject = asyncHandler(async (req, res) => {
  const data = await projectService.getProjectById(req.params.id);
  res.json({ success: true, data });
});

export const getProjectTasks = asyncHandler(async (req, res) => {
  const data = await projectService.getProjectTasks(req.params.id);
  res.json({ success: true, data });
});

export const createProject = asyncHandler(async (req, res) => {
  const data = await projectService.createProject(req.body, req.user);
  res.status(201).json({ success: true, message: 'Project created successfully', data });
});

export const updateProject = asyncHandler(async (req, res) => {
  const data = await projectService.updateProject(req.params.id, req.body);
  res.json({ success: true, message: 'Project updated successfully', data });
});

export const archiveProject = asyncHandler(async (req, res) => {
  const hardDelete = String(req.query.hard || '') === 'true';
  const result = await projectService.archiveProject(req.params.id, { hardDelete });
  res.json({
    success: true,
    message: result.deleted ? 'Project deleted permanently' : 'Project archived successfully',
    data: result.project ?? null,
  });
});
