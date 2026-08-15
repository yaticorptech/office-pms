import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdmin,
  createProject,
  createTask,
  createUser,
  del,
  get,
  patch,
  post,
  put,
  resetDatabase,
  startTestServer,
  stopTestServer,
} from './helpers/harness.js';

before(startTestServer);
after(stopTestServer);
beforeEach(resetDatabase);

let admin;
let employee;
let colleague;
let project;

beforeEach(async () => {
  admin = await createAdmin({ email: 'admin@office.test' });
  employee = await createUser({ email: 'employee@office.test', name: 'Priya Sharma' });
  colleague = await createUser({ email: 'colleague@office.test', name: 'Arjun Rao' });
  project = (await createProject(admin.token, { name: 'Main Project', owner: admin.id })).body.data;
});

const notificationsFor = async (token) => (await get('/api/notifications', { token })).body.data;

describe('assignment notifications (business rule 14)', () => {
  it('notifies the assignee when a task is created for them', async () => {
    await createTask(admin.token, {
      title: 'Write the brief', project: project._id, assignedTo: employee.id,
    });

    const notifications = await notificationsFor(employee.token);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'task_assigned');
    assert.match(notifications[0].title, /Write the brief/);
    assert.equal(notifications[0].read, false);
  });

  it('raises nothing when an admin assigns a task to themselves', async () => {
    await createTask(admin.token, {
      title: 'My own task', project: project._id, assignedTo: admin.id,
    });

    const notifications = await notificationsFor(admin.token);
    assert.equal(notifications.length, 0, 'nobody needs telling about their own action');
  });

  it('tells both people when a task moves to someone else', async () => {
    const task = (await createTask(admin.token, {
      title: 'Handover', project: project._id, assignedTo: employee.id,
    })).body.data;

    await put(`/api/tasks/${task._id}`, { assignedTo: colleague.id }, { token: admin.token });

    const newOwner = await notificationsFor(colleague.token);
    const previousOwner = await notificationsFor(employee.token);

    assert.equal(newOwner.length, 1);
    assert.equal(newOwner[0].type, 'task_reassigned');

    assert.equal(previousOwner.length, 2, 'the original assignment plus the hand-off');
    assert.equal(previousOwner[0].type, 'task_unassigned', 'newest first');
  });

  it('raises nothing when a task is updated without changing the assignee', async () => {
    const task = (await createTask(admin.token, {
      title: 'Stable', project: project._id, assignedTo: employee.id,
    })).body.data;

    await put(`/api/tasks/${task._id}`, { priority: 'urgent' }, { token: admin.token });

    const notifications = await notificationsFor(employee.token);
    assert.equal(notifications.length, 1, 'only the original assignment');
  });

  it('includes the due date in the message when the task has one', async () => {
    await createTask(admin.token, {
      title: 'Dated',
      project: project._id,
      assignedTo: employee.id,
      dueDate: new Date('2030-03-15T00:00:00.000Z').toISOString(),
    });

    const [notification] = await notificationsFor(employee.token);
    assert.match(notification.message, /Due 15 Mar 2030/);
  });
});

describe('GET /api/notifications', () => {
  beforeEach(async () => {
    await createTask(admin.token, { title: 'One', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Two', project: project._id, assignedTo: employee.id });
  });

  it('requires authentication', async () => {
    const res = await get('/api/notifications');
    assert.equal(res.status, 401);
  });

  it('returns only the caller’s own notifications', async () => {
    const mine = await get('/api/notifications', { token: employee.token });
    const theirs = await get('/api/notifications', { token: colleague.token });

    assert.equal(mine.body.data.length, 2);
    assert.equal(theirs.body.data.length, 0, 'a colleague sees none of them');
  });

  it('includes the unread count in meta', async () => {
    const res = await get('/api/notifications', { token: employee.token });
    assert.equal(res.body.meta.unreadCount, 2);
  });

  it('filters to unread only', async () => {
    const all = await get('/api/notifications', { token: employee.token });
    await patch(`/api/notifications/${all.body.data[0]._id}/read`, {}, { token: employee.token });

    const unread = await get('/api/notifications?unread=true', { token: employee.token });
    assert.equal(unread.body.data.length, 1);
  });

  it('sorts newest first', async () => {
    const res = await get('/api/notifications', { token: employee.token });
    assert.match(res.body.data[0].title, /Two/);
  });

  it('populates the linked task and actor', async () => {
    const res = await get('/api/notifications', { token: employee.token });

    const [notification] = res.body.data;
    assert.ok(notification.task?.title, 'the task is populated for the bell link');
    assert.equal(notification.actor.name, 'Admin User');
    assert.equal(notification.actor.passwordHash, undefined);
  });
});

describe('GET /api/notifications/unread-count', () => {
  it('returns a cheap count for the bell badge', async () => {
    await createTask(admin.token, { title: 'Badge', project: project._id, assignedTo: employee.id });

    const res = await get('/api/notifications/unread-count', { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.unreadCount, 1);
  });

  it('is scoped to the caller', async () => {
    await createTask(admin.token, { title: 'Badge', project: project._id, assignedTo: employee.id });

    const res = await get('/api/notifications/unread-count', { token: colleague.token });
    assert.equal(res.body.data.unreadCount, 0);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  let notificationId;

  beforeEach(async () => {
    await createTask(admin.token, { title: 'Readable', project: project._id, assignedTo: employee.id });
    notificationId = (await notificationsFor(employee.token))[0]._id;
  });

  it('marks the notification read and stamps readAt', async () => {
    const res = await patch(`/api/notifications/${notificationId}/read`, {}, { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.read, true);
    assert.ok(res.body.data.readAt);
  });

  it("returns 404 for someone else's notification, not 403", async () => {
    const res = await patch(`/api/notifications/${notificationId}/read`, {}, { token: colleague.token });

    assert.equal(res.status, 404, 'the existence of another user’s notification is not disclosed');
  });

  it('is idempotent', async () => {
    await patch(`/api/notifications/${notificationId}/read`, {}, { token: employee.token });
    const second = await patch(`/api/notifications/${notificationId}/read`, {}, { token: employee.token });

    assert.equal(second.status, 200);
    assert.equal(second.body.data.read, true);
  });
});

describe('POST /api/notifications/read-all', () => {
  it('marks every unread notification read for the caller only', async () => {
    await createTask(admin.token, { title: 'One', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Two', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Theirs', project: project._id, assignedTo: colleague.id });

    const res = await post('/api/notifications/read-all', {}, { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.updated, 2);

    const colleagueCount = await get('/api/notifications/unread-count', { token: colleague.token });
    assert.equal(colleagueCount.body.data.unreadCount, 1, 'the colleague is unaffected');
  });
});

describe('notification clean-up', () => {
  it('removes notifications when their task is deleted', async () => {
    const task = (await createTask(admin.token, {
      title: 'Doomed', project: project._id, assignedTo: employee.id,
    })).body.data;

    assert.equal((await notificationsFor(employee.token)).length, 1);

    await del(`/api/tasks/${task._id}`, { token: admin.token });

    assert.equal(
      (await notificationsFor(employee.token)).length,
      0,
      'the bell must not link to a task that no longer exists',
    );
  });

  it('removes notifications when their project is permanently deleted', async () => {
    await createTask(admin.token, { title: 'Doomed', project: project._id, assignedTo: employee.id });

    assert.equal((await notificationsFor(employee.token)).length, 1);

    await del(`/api/projects/${project._id}?hard=true`, { token: admin.token });

    assert.equal(
      (await notificationsFor(employee.token)).length,
      0,
      'hard-deleting a project takes its tasks, so their notifications must go too',
    );
  });

  it('keeps notifications when a project is merely archived', async () => {
    await createTask(admin.token, { title: 'Kept', project: project._id, assignedTo: employee.id });

    await del(`/api/projects/${project._id}`, { token: admin.token });

    assert.equal(
      (await notificationsFor(employee.token)).length,
      1,
      'archiving preserves history, so the notification stays',
    );
  });
});
