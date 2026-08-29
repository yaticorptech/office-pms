import { PROJECT_STATUS, TASK_STATUS } from '../config/constants.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { USER_STATUS } from '../config/constants.js';
import { getProjectStats } from './project.service.js';

const overdueMatch = (extra = {}) => ({
  ...extra,
  status: { $ne: TASK_STATUS.COMPLETED },
  dueDate: { $ne: null, $lt: new Date() },
});

/** One aggregation returning a count per task status for the given scope. */
const countTasksByStatus = async (match = {}) => {
  const rows = await Task.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = { total: 0, todo: 0, inProgress: 0, completed: 0 };
  rows.forEach((row) => {
    counts.total += row.count;
    if (row._id === TASK_STATUS.TODO) counts.todo = row.count;
    if (row._id === TASK_STATUS.IN_PROGRESS) counts.inProgress = row.count;
    if (row._id === TASK_STATUS.COMPLETED) counts.completed = row.count;
  });
  return counts;
};

const TASK_POPULATE = [
  { path: 'project', select: 'name type status' },
  { path: 'assignedTo', select: 'name email department profilePhoto' },
];

export const getAdminDashboard = async (user) => {
  // Admins can be assignees too — their own open work gets a personal section.
  const myScope = { assignedTo: user._id, status: { $ne: TASK_STATUS.COMPLETED } };

  const [
    totalProjects,
    activeProjects,
    archivedProjects,
    taskCounts,
    overdueCount,
    totalEmployees,
    activeEmployees,
    recentProjectDocs,
    recentTasks,
    overdueTasks,
    myTasks,
    myOpenTaskCount,
    selfAssignedTasks,
    selfAssignedCount,
  ] = await Promise.all([
    Project.countDocuments(),
    Project.countDocuments({ status: PROJECT_STATUS.ACTIVE }),
    Project.countDocuments({ status: PROJECT_STATUS.ARCHIVED }),
    countTasksByStatus(),
    Task.countDocuments(overdueMatch()),
    User.countDocuments(),
    User.countDocuments({ status: USER_STATUS.ACTIVE }),
    Project.find()
      .populate('owner', 'name email department profilePhoto')
      .sort('-createdAt')
      .limit(5)
      .lean(),
    Task.find().populate(TASK_POPULATE).sort('-createdAt').limit(5).lean(),
    Task.find(overdueMatch()).populate(TASK_POPULATE).sort({ dueDate: 1 }).limit(5).lean(),
    Task.find(myScope)
      .populate(TASK_POPULATE)
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(5)
      .lean(),
    Task.countDocuments(myScope),
    // Tasks employees created for themselves — admins get a dedicated section
    // so self-picked work stays visible.
    Task.find({ selfAssigned: true }).populate(TASK_POPULATE).sort('-createdAt').limit(5).lean(),
    Task.countDocuments({ selfAssigned: true }),
  ]);

  const stats = await getProjectStats(recentProjectDocs.map((project) => project._id));
  const recentProjects = recentProjectDocs.map((project) => ({
    ...project,
    stats: stats.get(String(project._id)),
  }));

  return {
    summary: {
      totalProjects,
      activeProjects,
      archivedProjects,
      totalTasks: taskCounts.total,
      todo: taskCounts.todo,
      inProgress: taskCounts.inProgress,
      completed: taskCounts.completed,
      overdue: overdueCount,
      totalEmployees,
      activeEmployees,
      myOpenTasks: myOpenTaskCount,
      selfAssigned: selfAssignedCount,
    },
    recentProjects,
    recentTasks,
    overdueTasks,
    myTasks,
    selfAssignedTasks,
  };
};

export const getEmployeeDashboard = async (user) => {
  const scope = { assignedTo: user._id };

  const [taskCounts, overdueCount, activeTasks, upcomingProjects] = await Promise.all([
    countTasksByStatus(scope),
    Task.countDocuments(overdueMatch(scope)),
    Task.find({ ...scope, status: { $ne: TASK_STATUS.COMPLETED } })
      .populate(TASK_POPULATE)
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(10)
      .lean(),
    Task.distinct('project', scope),
  ]);

  // The projects an employee actually touches — derived from their assignments.
  const projectDocs = await Project.find({ _id: { $in: upcomingProjects } })
    .populate('owner', 'name email')
    .sort('-createdAt')
    .limit(5)
    .lean();
  const stats = await getProjectStats(projectDocs.map((project) => project._id));

  return {
    summary: {
      totalTasks: taskCounts.total,
      todo: taskCounts.todo,
      inProgress: taskCounts.inProgress,
      completed: taskCounts.completed,
      overdue: overdueCount,
    },
    activeTasks,
    myProjects: projectDocs.map((project) => ({
      ...project,
      stats: stats.get(String(project._id)),
    })),
  };
};
