import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdmin,
  createProject,
  createTask,
  createUser,
  daysFromNow,
  del,
  get,
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
  employee = await createUser({ email: 'employee@office.test' });
  colleague = await createUser({ email: 'colleague@office.test' });
  project = (await createProject(admin.token, {
    name: 'Main Project', owner: admin.id, status: 'active',
  })).body.data;
});

describe('GET /api/dashboard/admin', () => {
  it('is admin-only', async () => {
    const res = await get('/api/dashboard/admin', { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('requires authentication', async () => {
    const res = await get('/api/dashboard/admin');
    assert.equal(res.status, 401);
  });

  it('summarises projects, tasks and people across the whole company', async () => {
    const archived = (await createProject(admin.token, { name: 'Old', owner: admin.id })).body.data;
    await del(`/api/projects/${archived._id}`, { token: admin.token });

    await createTask(admin.token, { title: 'Task One', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, {
      title: 'Task Two', project: project._id, assignedTo: colleague.id, status: 'completed',
    });
    await createTask(admin.token, {
      title: 'Task Three', project: project._id, assignedTo: employee.id,
      dueDate: daysFromNow(-3).toISOString(),
    });

    const res = await get('/api/dashboard/admin', { token: admin.token });

    assert.equal(res.status, 200);
    const { summary } = res.body.data;

    assert.equal(summary.totalProjects, 2);
    assert.equal(summary.activeProjects, 1);
    assert.equal(summary.archivedProjects, 1);
    assert.equal(summary.totalTasks, 3);
    assert.equal(summary.completed, 1);
    assert.equal(summary.todo, 2);
    assert.equal(summary.overdue, 1);
    assert.equal(summary.totalEmployees, 3);
    assert.equal(summary.activeEmployees, 3);
  });

  it('excludes completed tasks from the overdue figure (business rule 7)', async () => {
    await createTask(admin.token, {
      title: 'Late but done', project: project._id, assignedTo: employee.id,
      dueDate: daysFromNow(-3).toISOString(), status: 'completed',
    });

    const res = await get('/api/dashboard/admin', { token: admin.token });
    assert.equal(res.body.data.summary.overdue, 0);
  });

  it('counts inactive employees separately', async () => {
    await createUser({ email: 'gone@office.test', status: 'inactive' });

    const res = await get('/api/dashboard/admin', { token: admin.token });

    assert.equal(res.body.data.summary.totalEmployees, 4);
    assert.equal(res.body.data.summary.activeEmployees, 3);
  });

  it('returns recent projects with stats, recent tasks and overdue tasks', async () => {
    await createTask(admin.token, {
      title: 'Overdue one', project: project._id, assignedTo: employee.id,
      dueDate: daysFromNow(-1).toISOString(),
    });

    const res = await get('/api/dashboard/admin', { token: admin.token });
    const { recentProjects, recentTasks, overdueTasks } = res.body.data;

    assert.ok(Array.isArray(recentProjects) && recentProjects.length >= 1);
    assert.ok(recentProjects[0].stats, 'recent projects carry their progress stats');
    assert.equal(recentTasks.length, 1);
    assert.equal(overdueTasks.length, 1);
    assert.ok(!JSON.stringify(res.body).includes('$2'), 'no password hashes in populated users');
  });

  it('handles an empty system without dividing by zero', async () => {
    await resetDatabase();
    const freshAdmin = await createAdmin({ email: 'fresh@office.test' });

    const res = await get('/api/dashboard/admin', { token: freshAdmin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.totalProjects, 0);
    assert.equal(res.body.data.summary.totalTasks, 0);
    assert.deepEqual(res.body.data.recentProjects, []);
  });
});

describe('GET /api/dashboard/employee', () => {
  it('is readable by an employee', async () => {
    const res = await get('/api/dashboard/employee', { token: employee.token });
    assert.equal(res.status, 200);
  });

  it('counts only the caller’s own tasks', async () => {
    await createTask(admin.token, { title: 'Mine one', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, {
      title: 'Mine two', project: project._id, assignedTo: employee.id, status: 'completed',
    });
    await createTask(admin.token, { title: 'Theirs', project: project._id, assignedTo: colleague.id });

    const res = await get('/api/dashboard/employee', { token: employee.token });
    const { summary } = res.body.data;

    assert.equal(summary.totalTasks, 2, 'a colleague’s task is not counted');
    assert.equal(summary.completed, 1);
    assert.equal(summary.todo, 1);
  });

  it('counts only the caller’s own overdue tasks', async () => {
    await createTask(admin.token, {
      title: 'Mine late', project: project._id, assignedTo: employee.id,
      dueDate: daysFromNow(-2).toISOString(),
    });
    await createTask(admin.token, {
      title: 'Theirs late', project: project._id, assignedTo: colleague.id,
      dueDate: daysFromNow(-2).toISOString(),
    });

    const res = await get('/api/dashboard/employee', { token: employee.token });
    assert.equal(res.body.data.summary.overdue, 1);
  });

  it('lists active tasks and excludes completed ones', async () => {
    await createTask(admin.token, { title: 'Active', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, {
      title: 'Done', project: project._id, assignedTo: employee.id, status: 'completed',
    });

    const res = await get('/api/dashboard/employee', { token: employee.token });

    assert.equal(res.body.data.activeTasks.length, 1);
    assert.equal(res.body.data.activeTasks[0].title, 'Active');
  });

  it('derives "my projects" from the caller’s assignments', async () => {
    const otherProject = (await createProject(admin.token, {
      name: 'Untouched', owner: admin.id,
    })).body.data;

    await createTask(admin.token, { title: 'Mine', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Theirs', project: otherProject._id, assignedTo: colleague.id });

    const res = await get('/api/dashboard/employee', { token: employee.token });

    assert.equal(res.body.data.myProjects.length, 1);
    assert.equal(res.body.data.myProjects[0].name, 'Main Project');
  });

  it('returns empty collections for someone with no work assigned', async () => {
    const res = await get('/api/dashboard/employee', { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.totalTasks, 0);
    assert.deepEqual(res.body.data.activeTasks, []);
    assert.deepEqual(res.body.data.myProjects, []);
  });

  it('is also available to an admin, scoped to their own tasks', async () => {
    await createTask(admin.token, { title: 'Admin task', project: project._id, assignedTo: admin.id });
    await createTask(admin.token, { title: 'Other', project: project._id, assignedTo: employee.id });

    const res = await get('/api/dashboard/employee', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.totalTasks, 1);
  });
});
