import mongoose from 'mongoose';
import { ROLES, TASK_STATUS, USER_STATUS } from '../config/constants.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPageMeta, escapeRegex, getPagination } from '../utils/pagination.js';

/** Active / completed task counts for a set of users, in a single aggregation. */
const getTaskCounts = async (userIds) => {
  if (userIds.length === 0) return new Map();

  const rows = await Task.aggregate([
    { $match: { assignedTo: { $in: userIds } } },
    { $group: { _id: { user: '$assignedTo', status: '$status' }, count: { $sum: 1 } } },
  ]);

  const counts = new Map();
  userIds.forEach((id) => counts.set(String(id), { activeTasks: 0, completedTasks: 0, totalTasks: 0 }));

  rows.forEach(({ _id, count }) => {
    const entry = counts.get(String(_id.user));
    if (!entry) return;
    entry.totalTasks += count;
    if (_id.status === TASK_STATUS.COMPLETED) entry.completedTasks += count;
    else entry.activeTasks += count;
  });

  return counts;
};

export const listEmployees = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  if (query.department) filter.department = query.department;
  if (query.status) filter.status = query.status;
  if (query.role) filter.role = query.role;

  const sort = query.sort || 'name';

  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const counts = await getTaskCounts(users.map((user) => user._id));

  const data = users.map((user) => ({
    ...user,
    ...(counts.get(String(user._id)) || { activeTasks: 0, completedTasks: 0, totalTasks: 0 }),
  }));

  return { data, meta: buildPageMeta({ page, limit, total }) };
};

/** Lightweight list used by the "assign to" dropdown — active accounts only. */
export const listAssignableEmployees = async () => {
  const users = await User.find({ status: USER_STATUS.ACTIVE })
    .select('name email department role')
    .sort('name')
    .lean();
  return users;
};

export const getEmployeeById = async (id) => {
  const user = await User.findById(id).lean();
  if (!user) throw ApiError.notFound('Employee not found');

  const counts = await getTaskCounts([new mongoose.Types.ObjectId(id)]);
  const [recentTasks, ownedProjects] = await Promise.all([
    Task.find({ assignedTo: id })
      .populate('project', 'name type status')
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(10)
      .lean(),
    Project.find({ owner: id }).select('name type status').sort('-createdAt').limit(10).lean(),
  ]);

  return {
    ...user,
    ...(counts.get(String(id)) || { activeTasks: 0, completedTasks: 0, totalTasks: 0 }),
    recentTasks,
    ownedProjects,
  };
};

export const createEmployee = async (payload) => {
  const existing = await User.findOne({ email: payload.email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    passwordHash: await User.hashPassword(payload.password),
    department: payload.department,
    role: payload.role,
    profilePhoto: payload.profilePhoto,
    status: payload.status,
  });

  return user.toJSON();
};

export const updateEmployee = async (id, payload, requestingUser) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Employee not found');

  const isSelf = String(user._id) === String(requestingUser._id);

  if (payload.email && payload.email !== user.email) {
    const clash = await User.findOne({ email: payload.email, _id: { $ne: user._id } });
    if (clash) throw ApiError.conflict('An account with this email already exists');
    user.email = payload.email;
  }

  // Guards against an admin locking themselves out of the system.
  if (payload.role && payload.role !== user.role && isSelf) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  if (payload.status && payload.status !== user.status && isSelf) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  if (user.role === ROLES.ADMIN && (payload.role === ROLES.EMPLOYEE || payload.status === USER_STATUS.INACTIVE)) {
    await assertNotLastActiveAdmin(user._id);
  }

  if (payload.name !== undefined) user.name = payload.name;
  if (payload.department !== undefined) user.department = payload.department;
  if (payload.role !== undefined) user.role = payload.role;
  if (payload.profilePhoto !== undefined) user.profilePhoto = payload.profilePhoto;
  if (payload.status !== undefined) user.status = payload.status;
  if (payload.password) user.passwordHash = await User.hashPassword(payload.password);

  await user.save();
  return user.toJSON();
};

const assertNotLastActiveAdmin = async (excludedId) => {
  const otherAdmins = await User.countDocuments({
    _id: { $ne: excludedId },
    role: ROLES.ADMIN,
    status: USER_STATUS.ACTIVE,
  });
  if (otherAdmins === 0) {
    throw ApiError.badRequest('At least one active admin account must remain');
  }
};

export const setEmployeeStatus = async (id, status, requestingUser) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('Employee not found');

  if (String(user._id) === String(requestingUser._id) && status === USER_STATUS.INACTIVE) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  if (user.role === ROLES.ADMIN && status === USER_STATUS.INACTIVE) {
    await assertNotLastActiveAdmin(user._id);
  }

  user.status = status;
  await user.save();
  return user.toJSON();
};
