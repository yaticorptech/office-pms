import { NOTIFICATION_TYPE } from '../config/constants.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';

const POPULATE = [
  { path: 'task', select: 'title status priority dueDate' },
  { path: 'project', select: 'name type' },
  { path: 'actor', select: 'name profilePhoto' },
];

/**
 * Raises a notification, skipping the case where someone triggers an event on
 * themselves — nobody needs telling about their own action.
 */
const create = async ({ user, actor, type, title, message, task, project }) => {
  if (!user) return null;
  if (actor && String(user) === String(actor)) return null;

  return Notification.create({
    user,
    actor: actor || null,
    type,
    title,
    message,
    task: task || null,
    project: project || null,
  });
};

const dueLine = (task) =>
  task.dueDate ? ` Due ${new Date(task.dueDate).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })}.` : '';

export const notifyTaskAssigned = async ({ task, project, actor }) =>
  create({
    user: task.assignedTo,
    actor,
    type: NOTIFICATION_TYPE.TASK_ASSIGNED,
    title: `New task: ${task.title}`,
    message: `You have been assigned a task in ${project?.name || 'a project'}.${dueLine(task)}`,
    task: task._id,
    project: task.project,
  });

export const notifyTaskReassigned = async ({ task, project, actor, previousAssignee }) => {
  const notifications = [
    create({
      user: task.assignedTo,
      actor,
      type: NOTIFICATION_TYPE.TASK_REASSIGNED,
      title: `Task assigned to you: ${task.title}`,
      message: `This task in ${project?.name || 'a project'} is now yours.${dueLine(task)}`,
      task: task._id,
      project: task.project,
    }),
  ];

  // The previous owner is told too, so work does not silently disappear from their list.
  if (previousAssignee && String(previousAssignee) !== String(task.assignedTo)) {
    notifications.push(
      create({
        user: previousAssignee,
        actor,
        type: NOTIFICATION_TYPE.TASK_UNASSIGNED,
        title: `Task reassigned: ${task.title}`,
        message: `This task is no longer assigned to you.`,
        task: task._id,
        project: task.project,
      }),
    );
  }

  return Promise.all(notifications);
};

export const listNotifications = async (userId, query = {}) => {
  const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 10 });

  const filter = { user: userId };
  if (query.unread === true) filter.read = false;

  const [data, total, unreadCount] = await Promise.all([
    Notification.find(filter).populate(POPULATE).sort('-createdAt').skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, read: false }),
  ]);

  return { data, meta: { ...buildPageMeta({ page, limit, total }), unreadCount } };
};

export const getUnreadCount = async (userId) =>
  Notification.countDocuments({ user: userId, read: false });

export const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, user: userId });
  if (!notification) throw ApiError.notFound('Notification not found');

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification.toJSON();
};

export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return { updated: result.modifiedCount ?? 0 };
};

/** Removes notifications pointing at a task that no longer exists. */
export const removeForTask = (taskId) => Notification.deleteMany({ task: taskId });

/** Bulk equivalent, used when a project is deleted along with all of its tasks. */
export const removeForTasks = (taskIds = []) =>
  (taskIds.length === 0 ? Promise.resolve(null) : Notification.deleteMany({ task: { $in: taskIds } }));
