import mongoose from 'mongoose';
import {
  EMPLOYEE_STATUS_TRANSITIONS,
  PROJECT_STATUS,
  ROLES,
  TASK_STATUS,
  USER_STATUS,
} from '../config/constants.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPageMeta, escapeRegex, getPagination } from '../utils/pagination.js';
import * as notificationService from './notification.service.js';

const POPULATE = [
  { path: 'project', select: 'name type status owner' },
  { path: 'assignedTo', select: 'name email department profilePhoto status' },
  { path: 'createdBy', select: 'name email' },
];

// Sorting by priority needs weights; the stored slugs are not alphabetically ordered.
const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };

/** Business rule #11: archived projects do not accept new or moved-in tasks. */
const assertProjectAcceptsTasks = async (projectId) => {
  const project = await Project.findById(projectId).select('name status').lean();
  if (!project) throw ApiError.badRequest('Selected project does not exist');
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    throw ApiError.badRequest(`"${project.name}" is archived and cannot accept new tasks`);
  }
  return project;
};

/** Business rule #12: inactive employees cannot receive task assignments. */
const assertAssigneeIsAssignable = async (userId) => {
  const user = await User.findById(userId).select('name status').lean();
  if (!user) throw ApiError.badRequest('Selected employee does not exist');
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.badRequest(`${user.name} is inactive and cannot be assigned new tasks`);
  }
  return user;
};

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

/**
 * Everything except the status / overdue selection. Kept separate so the status tab
 * counts can reflect the other active filters without being skewed by the tab itself.
 *
 * Ids are cast explicitly because `$match` in an aggregation does not cast, unlike `find`.
 */
const buildBaseTaskFilter = (query = {}, requestingUser) => {
  const filter = {};

  // Employees are hard-scoped to their own tasks regardless of the query string.
  if (requestingUser.role !== ROLES.ADMIN) {
    filter.assignedTo = toObjectId(requestingUser._id);
  } else if (query.mine) {
    filter.assignedTo = toObjectId(requestingUser._id);
  } else if (query.assignedTo) {
    filter.assignedTo = toObjectId(query.assignedTo);
  }

  if (query.search) filter.title = new RegExp(escapeRegex(query.search), 'i');
  if (query.project) filter.project = toObjectId(query.project);
  if (query.priority) filter.priority = query.priority;

  return filter;
};

const overdueDueDateClause = () => ({ $ne: null, $lt: new Date() });

export const buildTaskFilter = (query = {}, requestingUser) => {
  const filter = buildBaseTaskFilter(query, requestingUser);

  if (query.overdue !== true) {
    if (query.status) filter.status = query.status;
    return filter;
  }

  filter.dueDate = overdueDueDateClause();

  if (!query.status) {
    filter.status = { $ne: TASK_STATUS.COMPLETED };
  } else if (query.status === TASK_STATUS.COMPLETED) {
    // A completed task is never overdue, so this combination has no results by
    // definition — returning the overdue set here would contradict the filter shown.
    filter.status = { $in: [] };
  } else {
    filter.status = query.status;
  }

  return filter;
};

/** Counts behind the status tabs — respects every filter except status/overdue. */
export const getTaskCounts = async (query = {}, requestingUser) => {
  const base = buildBaseTaskFilter(query, requestingUser);

  const [rows, overdue] = await Promise.all([
    Task.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.countDocuments({
      ...base,
      status: { $ne: TASK_STATUS.COMPLETED },
      dueDate: overdueDueDateClause(),
    }),
  ]);

  const counts = { all: 0, todo: 0, in_progress: 0, completed: 0, overdue };
  rows.forEach((row) => {
    counts.all += row.count;
    if (row._id in counts) counts[row._id] = row.count;
  });

  return counts;
};

/**
 * Sorts MongoDB cannot express directly on the stored fields:
 * - `priority` — the stored slugs are not in rank order (urgent < high alphabetically).
 * - `dueDate`  — Mongo orders `null` before every real date, but an undated task
 *   belongs at the end of the list in both directions, not the top.
 *
 * Both are resolved with computed fields in an aggregation.
 */
const COMPUTED_SORTS = new Set(['priority', '-priority', 'dueDate', '-dueDate']);

const buildComputedSortStage = (sortKey) => {
  const direction = sortKey.startsWith('-') ? -1 : 1;

  if (sortKey.endsWith('priority')) {
    return { priorityWeight: direction, undated: 1, dueDate: 1, _id: 1 };
  }
  return { undated: 1, dueDate: direction, createdAt: -1, _id: 1 };
};

export const listTasks = async (query = {}, requestingUser) => {
  const { page, limit, skip } = getPagination(query);
  const filter = buildTaskFilter(query, requestingUser);
  const sortKey = query.sort || 'dueDate';
  const countsPromise = getTaskCounts(query, requestingUser);

  if (COMPUTED_SORTS.has(sortKey)) {
    const [data, total, counts] = await Promise.all([
      Task.aggregate([
        { $match: filter },
        {
          $addFields: {
            priorityWeight: {
              $switch: {
                branches: Object.entries(PRIORITY_WEIGHT).map(([value, weight]) => ({
                  case: { $eq: ['$priority', value] },
                  then: weight,
                })),
                default: 0,
              },
            },
            // 1 for "has no due date", so ascending order pushes those rows last.
            undated: { $cond: [{ $eq: ['$dueDate', null] }, 1, 0] },
          },
        },
        { $sort: buildComputedSortStage(sortKey) },
        { $skip: skip },
        { $limit: limit },
        // Sorting scaffolding, not part of the task's API shape.
        { $unset: ['priorityWeight', 'undated'] },
      ]).then((rows) => Task.populate(rows, POPULATE)),
      Task.countDocuments(filter),
      countsPromise,
    ]);
    return { data, meta: { ...buildPageMeta({ page, limit, total }), counts } };
  }

  let listQuery = Task.find(filter).populate(POPULATE).sort(sortKey).skip(skip).limit(limit);

  // MongoDB's default string ordering is byte-wise, which puts "Create Instagram"
  // before "Create course". Collation gives the A–Z order a reader expects.
  if (sortKey === 'title' || sortKey === '-title') {
    listQuery = listQuery.collation({ locale: 'en', strength: 2 });
  }

  const [data, total, counts] = await Promise.all([
    listQuery.lean(),
    Task.countDocuments(filter),
    countsPromise,
  ]);

  return { data, meta: { ...buildPageMeta({ page, limit, total }), counts } };
};

export const getTaskById = async (id, requestingUser) => {
  const task = await Task.findById(id).populate(POPULATE).lean();
  if (!task) throw ApiError.notFound('Task not found');

  const isOwnTask = String(task.assignedTo?._id) === String(requestingUser._id);
  if (requestingUser.role !== ROLES.ADMIN && !isOwnTask) {
    throw ApiError.forbidden('You can only view tasks assigned to you');
  }

  return task;
};

export const createTask = async (payload, createdBy) => {
  const project = await assertProjectAcceptsTasks(payload.project);
  await assertAssigneeIsAssignable(payload.assignedTo);

  const task = await Task.create({ ...payload, createdBy: createdBy._id });

  // The assignee is told in-app that work has landed on their plate.
  await notificationService.notifyTaskAssigned({ task, project, actor: createdBy._id });

  return Task.findById(task._id).populate(POPULATE).lean();
};

export const updateTask = async (id, payload, requestingUser) => {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found');

  if (payload.project && String(payload.project) !== String(task.project)) {
    await assertProjectAcceptsTasks(payload.project);
  }
  if (payload.assignedTo && String(payload.assignedTo) !== String(task.assignedTo)) {
    await assertAssigneeIsAssignable(payload.assignedTo);
  }

  const previousAssignee = String(task.assignedTo);

  // Only fields the caller actually sent are touched; `null` clears, absent leaves alone.
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    task[key] = value;
  });

  await task.save();

  if (String(task.assignedTo) !== previousAssignee) {
    const project = await Project.findById(task.project).select('name').lean();
    await notificationService.notifyTaskReassigned({
      task,
      project,
      actor: requestingUser?._id,
      previousAssignee,
    });
  }

  return Task.findById(task._id).populate(POPULATE).lean();
};

/**
 * Status-only update. Admins may set any status; an employee may only move their own
 * task along the allowed transitions (To Do → In Progress → Completed, and back).
 */
export const updateTaskStatus = async (id, status, requestingUser) => {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found');

  if (requestingUser.role !== ROLES.ADMIN) {
    if (String(task.assignedTo) !== String(requestingUser._id)) {
      throw ApiError.forbidden('You can only update tasks assigned to you');
    }
    const allowed = EMPLOYEE_STATUS_TRANSITIONS[task.status] || [];
    if (status !== task.status && !allowed.includes(status)) {
      throw ApiError.badRequest('That status change is not allowed');
    }
  }

  task.status = status;
  await task.save();
  return Task.findById(task._id).populate(POPULATE).lean();
};

export const deleteTask = async (id) => {
  const task = await Task.findById(id);
  if (!task) throw ApiError.notFound('Task not found');
  await task.deleteOne();
  // Otherwise the bell would link to a task that no longer exists.
  await notificationService.removeForTask(task._id);
};
