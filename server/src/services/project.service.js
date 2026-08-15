import mongoose from 'mongoose';
import { PROJECT_STATUS, ROLES, TASK_STATUS } from '../config/constants.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPageMeta, escapeRegex, getPagination } from '../utils/pagination.js';
import * as notificationService from './notification.service.js';

const OWNER_FIELDS = 'name email department role profilePhoto';

/**
 * Task totals per project. Progress is completed / total × 100 (0% when a project
 * has no tasks), per the Phase 1 progress rule.
 */
export const getProjectStats = async (projectIds) => {
  const ids = projectIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const stats = new Map();
  ids.forEach((id) =>
    stats.set(String(id), {
      totalTasks: 0,
      todo: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
      progress: 0,
    }),
  );
  if (ids.length === 0) return stats;

  const now = new Date();
  const rows = await Task.aggregate([
    { $match: { project: { $in: ids } } },
    {
      $group: {
        _id: '$project',
        totalTasks: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.TODO] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.IN_PROGRESS] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', TASK_STATUS.COMPLETED] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', TASK_STATUS.COMPLETED] },
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', now] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  rows.forEach((row) => {
    stats.set(String(row._id), {
      totalTasks: row.totalTasks,
      todo: row.todo,
      inProgress: row.inProgress,
      completed: row.completed,
      overdue: row.overdue,
      progress: row.totalTasks === 0 ? 0 : Math.round((row.completed / row.totalTasks) * 100),
    });
  });

  return stats;
};

const assertOwnerIsValid = async (ownerId) => {
  const owner = await User.findById(ownerId).select('name status').lean();
  if (!owner) throw ApiError.badRequest('Selected project owner does not exist');
  return owner;
};

export const listProjects = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.owner) filter.owner = query.owner;

  const sort = query.sort || '-createdAt';

  const [projects, total] = await Promise.all([
    Project.find(filter).populate('owner', OWNER_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter),
  ]);

  const stats = await getProjectStats(projects.map((project) => project._id));
  const data = projects.map((project) => ({ ...project, stats: stats.get(String(project._id)) }));

  return { data, meta: buildPageMeta({ page, limit, total }) };
};

/** Compact list for dropdowns (task form, filters). */
export const listProjectOptions = async () => {
  const projects = await Project.find().select('name type status').sort('name').lean();
  return projects;
};

export const getProjectById = async (id) => {
  const project = await Project.findById(id)
    .populate('owner', OWNER_FIELDS)
    .populate('createdBy', 'name email')
    .lean();
  if (!project) throw ApiError.notFound('Project not found');

  const stats = await getProjectStats([project._id]);
  return { ...project, stats: stats.get(String(project._id)) };
};

export const createProject = async (payload, createdBy) => {
  await assertOwnerIsValid(payload.owner);

  const project = await Project.create({ ...payload, createdBy: createdBy._id });
  return getProjectById(project._id);
};

export const updateProject = async (id, payload) => {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');

  if (payload.owner) await assertOwnerIsValid(payload.owner);

  // Only fields the caller actually sent are touched; `null` clears, absent leaves alone.
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    project[key] = value;
  });

  // Re-check the range against stored values when only one of the two dates changes.
  if (project.endDate && project.startDate && project.endDate < project.startDate) {
    throw ApiError.badRequest('End date cannot be before the start date');
  }

  await project.save();
  return getProjectById(project._id);
};

/**
 * Archiving is the default "delete" — it keeps the project and its task history
 * intact. `?hard=true` permanently removes the project and its tasks.
 */
export const archiveProject = async (id, { hardDelete = false } = {}) => {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');

  if (hardDelete) {
    // The tasks go, so their notifications must go with them — otherwise the bell
    // would link to work that no longer exists.
    const taskIds = await Task.find({ project: project._id }).distinct('_id');
    await notificationService.removeForTasks(taskIds);
    await Task.deleteMany({ project: project._id });
    await project.deleteOne();
    return { deleted: true, archived: false };
  }

  project.status = PROJECT_STATUS.ARCHIVED;
  await project.save();
  return { deleted: false, archived: true, project: await getProjectById(project._id) };
};

export const getProjectTasks = async (id, requestingUser) => {
  const project = await Project.findById(id).select('_id').lean();
  if (!project) throw ApiError.notFound('Project not found');

  const filter = { project: id };
  // Employees see only their own work here, exactly as they do on /api/tasks.
  // Without this the route would be a way around that restriction.
  if (requestingUser.role !== ROLES.ADMIN) filter.assignedTo = requestingUser._id;

  return Task.find(filter)
    .populate('assignedTo', 'name email department profilePhoto')
    .sort({ status: 1, dueDate: 1 })
    .lean();
};
