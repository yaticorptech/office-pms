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

beforeEach(async () => {
  admin = await createAdmin({ email: 'admin@office.test' });
  employee = await createUser({ email: 'employee@office.test', name: 'Priya Sharma' });
});

describe('POST /api/projects', () => {
  it('creates a project as an admin', async () => {
    const res = await createProject(admin.token, { name: 'LMS Build', owner: admin.id });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.name, 'LMS Build');
    assert.equal(res.body.data.status, 'planning', 'defaults to planning');
    assert.equal(res.body.data.owner._id ?? res.body.data.owner.id, admin.id);
  });

  it('refuses an employee', async () => {
    const res = await createProject(employee.token, { name: 'Nope', owner: employee.id });
    assert.equal(res.status, 403);
  });

  it('refuses an anonymous caller', async () => {
    const res = await post('/api/projects', { name: 'Nope', owner: admin.id });
    assert.equal(res.status, 401);
  });

  it('stores an omitted type as null (business rule 11)', async () => {
    const res = await createProject(admin.token, { name: 'Untyped', owner: admin.id });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.type, null);
  });

  it('rejects an invalid type', async () => {
    const res = await createProject(admin.token, {
      name: 'Bad Type',
      owner: admin.id,
      type: 'astrology',
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /valid project type/i);
  });

  it('rejects an end date before the start date', async () => {
    const res = await createProject(admin.token, {
      name: 'Backwards',
      owner: admin.id,
      startDate: daysFromNow(10).toISOString(),
      endDate: daysFromNow(1).toISOString(),
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /end date/i);
  });

  it('rejects an owner that does not exist', async () => {
    const res = await createProject(admin.token, {
      name: 'Ghost Owner',
      owner: '507f1f77bcf86cd799439011',
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /owner does not exist/i);
  });

  it('rejects a malformed owner id', async () => {
    const res = await createProject(admin.token, { name: 'Bad Id', owner: 'not-an-id' });
    assert.equal(res.status, 400);
  });

  it('requires a start date', async () => {
    const res = await post(
      '/api/projects',
      { name: 'No Start', owner: admin.id },
      { token: admin.token },
    );
    assert.equal(res.status, 400);
  });
});

describe('GET /api/projects', () => {
  beforeEach(async () => {
    await createProject(admin.token, { name: 'Alpha Marketing', owner: admin.id, type: 'marketing' });
    await createProject(admin.token, { name: 'Beta Tech', owner: employee.id, type: 'technology' });
    await createProject(admin.token, { name: 'Gamma Untyped', owner: admin.id });
  });

  it('lists every project for an admin', async () => {
    const res = await get('/api/projects', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
    assert.equal(res.body.meta.total, 3);
  });

  it('is readable by an employee (they need project context)', async () => {
    const res = await get('/api/projects', { token: employee.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
  });

  it('filters by type and excludes untyped projects', async () => {
    const res = await get('/api/projects?type=marketing', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, 'Alpha Marketing');
  });

  it('includes the untyped project when no type filter is applied', async () => {
    const res = await get('/api/projects', { token: admin.token });
    assert.ok(res.body.data.some((project) => project.name === 'Gamma Untyped'));
  });

  it('treats "all" and "" as no filter', async () => {
    const all = await get('/api/projects?type=all&status=', { token: admin.token });
    assert.equal(all.status, 200);
    assert.equal(all.body.data.length, 3);
  });

  it('searches by name, case-insensitively', async () => {
    const res = await get('/api/projects?search=beta', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, 'Beta Tech');
  });

  it('treats regex metacharacters in search as literal text', async () => {
    const res = await get('/api/projects?search=.*', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0, 'the search string is escaped, not executed as a pattern');
  });

  it('filters by owner', async () => {
    const res = await get(`/api/projects?owner=${employee.id}`, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, 'Beta Tech');
  });

  it('paginates and reports totals', async () => {
    const res = await get('/api/projects?page=1&limit=2', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.meta.total, 3);
    assert.equal(res.body.meta.totalPages, 2);
  });

  it('rejects a limit above the maximum', async () => {
    const res = await get('/api/projects?limit=5000', { token: admin.token });
    assert.equal(res.status, 400);
  });

  it('rejects an unknown sort key', async () => {
    const res = await get('/api/projects?sort=passwordHash', { token: admin.token });
    assert.equal(res.status, 400);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns the project with computed stats', async () => {
    const created = await createProject(admin.token, { name: 'Stats', owner: admin.id });
    const res = await get(`/api/projects/${created.body.data._id}`, { token: admin.token });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.stats, {
      totalTasks: 0,
      todo: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
      progress: 0,
    });
  });

  it('reports 0% progress for a project with no tasks (business rule 8)', async () => {
    const created = await createProject(admin.token, { name: 'Empty', owner: admin.id });
    const res = await get(`/api/projects/${created.body.data._id}`, { token: admin.token });
    assert.equal(res.body.data.stats.progress, 0);
  });

  it('computes rounded progress from completed over total', async () => {
    const project = (await createProject(admin.token, { name: 'Progress', owner: admin.id })).body.data;

    // 1 of 3 completed → 33%
    await createTask(admin.token, { title: 'One', project: project._id, assignedTo: employee.id, status: 'completed' });
    await createTask(admin.token, { title: 'Two', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Three', project: project._id, assignedTo: employee.id });

    const res = await get(`/api/projects/${project._id}`, { token: admin.token });

    assert.equal(res.body.data.stats.totalTasks, 3);
    assert.equal(res.body.data.stats.completed, 1);
    assert.equal(res.body.data.stats.progress, 33);
  });

  it('counts overdue tasks but never completed ones (business rule 7)', async () => {
    const project = (await createProject(admin.token, { name: 'Overdue', owner: admin.id })).body.data;

    await createTask(admin.token, {
      title: 'Late', project: project._id, assignedTo: employee.id, dueDate: daysFromNow(-2).toISOString(),
    });
    await createTask(admin.token, {
      title: 'Late but done', project: project._id, assignedTo: employee.id,
      dueDate: daysFromNow(-2).toISOString(), status: 'completed',
    });

    const res = await get(`/api/projects/${project._id}`, { token: admin.token });
    assert.equal(res.body.data.stats.overdue, 1);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await get('/api/projects/507f1f77bcf86cd799439011', { token: admin.token });
    assert.equal(res.status, 404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await get('/api/projects/not-an-id', { token: admin.token });
    assert.equal(res.status, 400);
  });
});

describe('PUT /api/projects/:id', () => {
  let project;

  beforeEach(async () => {
    project = (
      await createProject(admin.token, {
        name: 'Original',
        owner: admin.id,
        type: 'marketing',
        description: 'Original description',
        endDate: daysFromNow(30).toISOString(),
      })
    ).body.data;
  });

  it('leaves omitted fields untouched (business rule 12)', async () => {
    const res = await put(`/api/projects/${project._id}`, { name: 'Renamed' }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Renamed');
    assert.equal(res.body.data.type, 'marketing', 'type survives a partial update');
    assert.equal(res.body.data.description, 'Original description');
    assert.ok(res.body.data.endDate, 'end date survives a partial update');
  });

  it('clears a field when null is sent explicitly', async () => {
    const res = await put(`/api/projects/${project._id}`, { type: null }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.type, null);
  });

  it('clears a field when an empty string is sent', async () => {
    const res = await put(`/api/projects/${project._id}`, { endDate: '' }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.endDate, null);
  });

  it('refuses an employee', async () => {
    const res = await put(`/api/projects/${project._id}`, { name: 'Hacked' }, { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('rejects an end date that would fall before the stored start date', async () => {
    const res = await put(
      `/api/projects/${project._id}`,
      { endDate: daysFromNow(-100).toISOString() },
      { token: admin.token },
    );

    assert.equal(res.status, 400, 'the range is re-checked against the stored start date');
  });

  it('rejects an invalid type on update', async () => {
    const res = await put(`/api/projects/${project._id}`, { type: 'astrology' }, { token: admin.token });
    assert.equal(res.status, 400);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await put(
      '/api/projects/507f1f77bcf86cd799439011',
      { name: 'Ghost' },
      { token: admin.token },
    );
    assert.equal(res.status, 404);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('archives by default and keeps the tasks', async () => {
    const project = (await createProject(admin.token, { name: 'To Archive', owner: admin.id })).body.data;
    await createTask(admin.token, { title: 'Kept', project: project._id, assignedTo: employee.id });

    const res = await del(`/api/projects/${project._id}`, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'archived');

    const tasks = await get(`/api/projects/${project._id}/tasks`, { token: admin.token });
    assert.equal(tasks.body.data.length, 1, 'archiving preserves task history');
  });

  it('permanently removes the project and its tasks with ?hard=true', async () => {
    const project = (await createProject(admin.token, { name: 'To Delete', owner: admin.id })).body.data;
    await createTask(admin.token, { title: 'Doomed', project: project._id, assignedTo: employee.id });

    const res = await del(`/api/projects/${project._id}?hard=true`, { token: admin.token });
    assert.equal(res.status, 200);

    const fetched = await get(`/api/projects/${project._id}`, { token: admin.token });
    assert.equal(fetched.status, 404);

    const { Task } = await import('../src/models/Task.js');
    assert.equal(await Task.countDocuments({ project: project._id }), 0, 'tasks are removed too');
  });

  it('refuses an employee', async () => {
    const project = (await createProject(admin.token, { name: 'Safe', owner: admin.id })).body.data;
    const res = await del(`/api/projects/${project._id}`, { token: employee.token });
    assert.equal(res.status, 403);
  });
});

describe('GET /api/projects/:id/tasks', () => {
  it('returns every task in the project for an admin', async () => {
    const project = (await createProject(admin.token, { name: 'Shared', owner: admin.id })).body.data;
    const other = await createUser({ email: 'other@office.test' });

    await createTask(admin.token, { title: 'Mine', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Theirs', project: project._id, assignedTo: other.id });

    const res = await get(`/api/projects/${project._id}/tasks`, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
  });

  it('shows an employee only their own tasks, matching /api/tasks scoping', async () => {
    const project = (await createProject(admin.token, { name: 'Shared', owner: admin.id })).body.data;
    const other = await createUser({ email: 'other@office.test' });

    await createTask(admin.token, { title: 'Mine', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Theirs', project: project._id, assignedTo: other.id });

    const res = await get(`/api/projects/${project._id}/tasks`, { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1, 'an employee cannot enumerate colleagues’ tasks here');
    assert.equal(res.body.data[0].title, 'Mine');
  });

  it('returns 404 for an unknown project', async () => {
    const res = await get('/api/projects/507f1f77bcf86cd799439011/tasks', { token: admin.token });
    assert.equal(res.status, 404);
  });
});

describe('GET /api/projects/options', () => {
  it('returns a compact list for dropdowns', async () => {
    await createProject(admin.token, { name: 'Option A', owner: admin.id });

    const res = await get('/api/projects/options', { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].description, undefined, 'only the fields a dropdown needs');
  });
});
