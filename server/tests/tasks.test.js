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

describe('POST /api/tasks', () => {
  it('creates a task as an admin', async () => {
    const res = await createTask(admin.token, {
      title: 'Write the spec',
      project: project._id,
      assignedTo: employee.id,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, 'Write the spec');
    assert.equal(res.body.data.status, 'todo');
    assert.equal(res.body.data.priority, 'medium');
  });

  it('refuses an employee (business rule 2)', async () => {
    const res = await createTask(employee.token, {
      title: 'Self assigned', project: project._id, assignedTo: employee.id,
    });
    assert.equal(res.status, 403);
  });

  it('requires a project and an assignee (business rule 1)', async () => {
    const noProject = await createTask(admin.token, { title: 'Orphan', assignedTo: employee.id });
    const noAssignee = await createTask(admin.token, { title: 'Unassigned', project: project._id });

    assert.equal(noProject.status, 400);
    assert.equal(noAssignee.status, 400);
  });

  it('rejects a task in an archived project (business rule 4)', async () => {
    await del(`/api/projects/${project._id}`, { token: admin.token });

    const res = await createTask(admin.token, {
      title: 'Too late', project: project._id, assignedTo: employee.id,
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /archived/i);
  });

  it('rejects assignment to an inactive employee (business rule 5)', async () => {
    const inactive = await createUser({ email: 'inactive@office.test', name: 'Gone Away', status: 'inactive' });

    const res = await createTask(admin.token, {
      title: 'Nobody home', project: project._id, assignedTo: inactive.id,
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /inactive/i);
  });

  it('allows any department to work on any project (business rule 6)', async () => {
    const marketer = await createUser({ email: 'marketer@office.test', department: 'marketing' });
    const techProject = (
      await createProject(admin.token, { name: 'Tech', owner: admin.id, type: 'technology' })
    ).body.data;

    const res = await createTask(admin.token, {
      title: 'Cross-department', project: techProject._id, assignedTo: marketer.id,
    });

    assert.equal(res.status, 201, 'department never restricts assignment');
  });

  it('rejects a project that does not exist', async () => {
    const res = await createTask(admin.token, {
      title: 'Ghost', project: '507f1f77bcf86cd799439011', assignedTo: employee.id,
    });
    assert.equal(res.status, 400);
  });

  it('sets completedAt when a task is created already completed', async () => {
    const res = await createTask(admin.token, {
      title: 'Done on arrival', project: project._id, assignedTo: employee.id, status: 'completed',
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.completedAt, 'completedAt is kept in step with status');
  });
});

describe('GET /api/tasks — scoping', () => {
  beforeEach(async () => {
    await createTask(admin.token, { title: 'Mine one', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Mine two', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, { title: 'Theirs', project: project._id, assignedTo: colleague.id });
  });

  it('shows an admin every task', async () => {
    const res = await get('/api/tasks', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
  });

  it('shows an employee only their own tasks (business rule 3)', async () => {
    const res = await get('/api/tasks', { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.data.every((task) => String(task.assignedTo._id ?? task.assignedTo.id) === employee.id));
  });

  it('ignores an employee trying to widen the scope with assignedTo', async () => {
    const res = await get(`/api/tasks?assignedTo=${colleague.id}`, { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2, 'the server pins the scope regardless of the query string');
    assert.ok(res.body.data.every((task) => task.title.startsWith('Mine')));
  });

  it('lets an admin filter by assignee', async () => {
    const res = await get(`/api/tasks?assignedTo=${colleague.id}`, { token: admin.token });
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].title, 'Theirs');
  });

  it('supports the admin "assigned to me" filter', async () => {
    await createTask(admin.token, { title: 'Admin task', project: project._id, assignedTo: admin.id });

    const res = await get('/api/tasks?mine=true', { token: admin.token });

    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].title, 'Admin task');
  });
});

describe('GET /api/tasks — filtering and sorting', () => {
  beforeEach(async () => {
    await createTask(admin.token, {
      title: 'Zebra urgent overdue', project: project._id, assignedTo: employee.id,
      priority: 'urgent', dueDate: daysFromNow(-5).toISOString(),
    });
    await createTask(admin.token, {
      title: 'apple low future', project: project._id, assignedTo: employee.id,
      priority: 'low', dueDate: daysFromNow(5).toISOString(),
    });
    await createTask(admin.token, {
      title: 'Mango high done', project: project._id, assignedTo: employee.id,
      priority: 'high', status: 'completed', dueDate: daysFromNow(-5).toISOString(),
    });
  });

  it('filters by status', async () => {
    const res = await get('/api/tasks?status=completed', { token: admin.token });
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].title, 'Mango high done');
  });

  it('filters by priority', async () => {
    const res = await get('/api/tasks?priority=urgent', { token: admin.token });
    assert.equal(res.body.data.length, 1);
  });

  it('returns only overdue, never-completed tasks for overdue=true (business rule 7)', async () => {
    const res = await get('/api/tasks?overdue=true', { token: admin.token });

    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].title, 'Zebra urgent overdue');
  });

  it('returns nothing for overdue=true combined with status=completed (business rule 13)', async () => {
    const res = await get('/api/tasks?overdue=true&status=completed', { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0, 'a completed task is never overdue');
    assert.equal(res.body.meta.total, 0);
  });

  it('sorts by real priority rank, not alphabetically', async () => {
    const res = await get('/api/tasks?sort=-priority', { token: admin.token });

    const priorities = res.body.data.map((task) => task.priority);
    assert.deepEqual(priorities, ['urgent', 'high', 'low']);
  });

  it('sorts by priority ascending', async () => {
    const res = await get('/api/tasks?sort=priority', { token: admin.token });
    assert.deepEqual(res.body.data.map((task) => task.priority), ['low', 'high', 'urgent']);
  });

  it('sorts titles case-insensitively', async () => {
    const res = await get('/api/tasks?sort=title', { token: admin.token });

    assert.deepEqual(
      res.body.data.map((task) => task.title),
      ['apple low future', 'Mango high done', 'Zebra urgent overdue'],
      'collation gives the A–Z order a reader expects',
    );
  });

  it('places tasks with no due date last when sorting by due date', async () => {
    await createTask(admin.token, { title: 'No due date', project: project._id, assignedTo: employee.id });

    const res = await get('/api/tasks?sort=dueDate', { token: admin.token });
    assert.equal(res.body.data.at(-1).title, 'No due date');
  });

  it('returns the same task shape whichever sort is used', async () => {
    const byDueDate = await get('/api/tasks?sort=dueDate', { token: admin.token });
    const byPriority = await get('/api/tasks?sort=-priority', { token: admin.token });
    const byCreated = await get('/api/tasks?sort=-createdAt', { token: admin.token });

    for (const res of [byDueDate, byPriority, byCreated]) {
      const [task] = res.body.data;
      assert.ok(task.title && task.project && task.assignedTo, 'populated the same way');
      assert.equal(task.priorityWeight, undefined, 'no sorting scaffolding leaks out');
      assert.equal(task.undated, undefined);
    }
  });

  it('escapes regex metacharacters in the search term', async () => {
    const res = await get('/api/tasks?search=.*', { token: admin.token });
    assert.equal(res.body.data.length, 0);
  });

  it('returns tab counts that ignore the status filter but respect the others', async () => {
    const res = await get('/api/tasks?status=completed', { token: admin.token });

    assert.equal(res.body.data.length, 1, 'the list itself is filtered');
    assert.equal(res.body.meta.counts.all, 3, 'counts cover every status');
    assert.equal(res.body.meta.counts.completed, 1);
    assert.equal(res.body.meta.counts.overdue, 1);
  });

  it('narrows the counts when a non-status filter is applied', async () => {
    const res = await get('/api/tasks?priority=urgent', { token: admin.token });
    assert.equal(res.body.meta.counts.all, 1, 'counts respect the priority filter');
  });

  it('scopes the counts to the employee', async () => {
    await createTask(admin.token, { title: 'Not mine', project: project._id, assignedTo: colleague.id });

    const res = await get('/api/tasks', { token: employee.token });
    assert.equal(res.body.meta.counts.all, 3, 'the employee never sees colleague totals');
  });
});

describe('GET /api/tasks/:id', () => {
  it('lets an admin read any task', async () => {
    const task = (await createTask(admin.token, {
      title: 'Any', project: project._id, assignedTo: employee.id,
    })).body.data;

    const res = await get(`/api/tasks/${task._id}`, { token: admin.token });
    assert.equal(res.status, 200);
  });

  it('lets an employee read their own task', async () => {
    const task = (await createTask(admin.token, {
      title: 'Mine', project: project._id, assignedTo: employee.id,
    })).body.data;

    const res = await get(`/api/tasks/${task._id}`, { token: employee.token });
    assert.equal(res.status, 200);
  });

  it("refuses an employee reading a colleague's task", async () => {
    const task = (await createTask(admin.token, {
      title: 'Theirs', project: project._id, assignedTo: colleague.id,
    })).body.data;

    const res = await get(`/api/tasks/${task._id}`, { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('returns 404 for an unknown task', async () => {
    const res = await get('/api/tasks/507f1f77bcf86cd799439011', { token: admin.token });
    assert.equal(res.status, 404);
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  let task;

  beforeEach(async () => {
    task = (await createTask(admin.token, {
      title: 'Movable', project: project._id, assignedTo: employee.id,
    })).body.data;
  });

  it('lets the assignee move To Do → In Progress', async () => {
    const res = await patch(`/api/tasks/${task._id}/status`, { status: 'in_progress' }, { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'in_progress');
  });

  it('lets the assignee move In Progress → Completed and stamps completedAt', async () => {
    await patch(`/api/tasks/${task._id}/status`, { status: 'in_progress' }, { token: employee.token });
    const res = await patch(`/api/tasks/${task._id}/status`, { status: 'completed' }, { token: employee.token });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.completedAt);
  });

  it('clears completedAt when a completed task is reopened', async () => {
    await patch(`/api/tasks/${task._id}/status`, { status: 'in_progress' }, { token: employee.token });
    await patch(`/api/tasks/${task._id}/status`, { status: 'completed' }, { token: employee.token });
    const res = await patch(`/api/tasks/${task._id}/status`, { status: 'in_progress' }, { token: employee.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.completedAt, null);
  });

  it('refuses an employee skipping To Do → Completed', async () => {
    const res = await patch(`/api/tasks/${task._id}/status`, { status: 'completed' }, { token: employee.token });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /not allowed/i);
  });

  it("refuses an employee touching a colleague's task", async () => {
    const theirs = (await createTask(admin.token, {
      title: 'Theirs', project: project._id, assignedTo: colleague.id,
    })).body.data;

    const res = await patch(`/api/tasks/${theirs._id}/status`, { status: 'in_progress' }, { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('lets an admin jump straight to any status', async () => {
    const res = await patch(`/api/tasks/${task._id}/status`, { status: 'completed' }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'completed');
  });

  it('rejects an invalid status value', async () => {
    const res = await patch(`/api/tasks/${task._id}/status`, { status: 'nearly_done' }, { token: admin.token });
    assert.equal(res.status, 400);
  });
});

describe('PUT /api/tasks/:id', () => {
  let task;

  beforeEach(async () => {
    task = (await createTask(admin.token, {
      title: 'Editable',
      description: 'Original description',
      project: project._id,
      assignedTo: employee.id,
      priority: 'high',
      dueDate: daysFromNow(7).toISOString(),
    })).body.data;
  });

  it('refuses an employee (they cannot reassign or re-project — business rule 3)', async () => {
    const res = await put(`/api/tasks/${task._id}`, { assignedTo: employee.id }, { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('leaves omitted fields untouched (business rule 12)', async () => {
    const res = await put(`/api/tasks/${task._id}`, { title: 'Renamed' }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Renamed');
    assert.equal(res.body.data.description, 'Original description');
    assert.equal(res.body.data.priority, 'high');
    assert.ok(res.body.data.dueDate, 'due date survives a partial update');
  });

  it('clears the due date when null is sent', async () => {
    const res = await put(`/api/tasks/${task._id}`, { dueDate: null }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.dueDate, null);
  });

  it('rejects an empty update body', async () => {
    const res = await put(`/api/tasks/${task._id}`, {}, { token: admin.token });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /no changes/i);
  });

  it('refuses moving a task into an archived project (business rule 4)', async () => {
    const archived = (await createProject(admin.token, { name: 'Archived', owner: admin.id })).body.data;
    await del(`/api/projects/${archived._id}`, { token: admin.token });

    const res = await put(`/api/tasks/${task._id}`, { project: archived._id }, { token: admin.token });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /archived/i);
  });

  it('refuses reassigning to an inactive employee (business rule 5)', async () => {
    const inactive = await createUser({ email: 'gone@office.test', name: 'Gone Away', status: 'inactive' });

    const res = await put(`/api/tasks/${task._id}`, { assignedTo: inactive.id }, { token: admin.token });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /inactive/i);
  });

  it('allows reassignment to an active employee', async () => {
    const res = await put(`/api/tasks/${task._id}`, { assignedTo: colleague.id }, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(String(res.body.data.assignedTo._id ?? res.body.data.assignedTo.id), colleague.id);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes as an admin', async () => {
    const task = (await createTask(admin.token, {
      title: 'Doomed', project: project._id, assignedTo: employee.id,
    })).body.data;

    const res = await del(`/api/tasks/${task._id}`, { token: admin.token });
    assert.equal(res.status, 200);

    const fetched = await get(`/api/tasks/${task._id}`, { token: admin.token });
    assert.equal(fetched.status, 404);
  });

  it('refuses an employee', async () => {
    const task = (await createTask(admin.token, {
      title: 'Safe', project: project._id, assignedTo: employee.id,
    })).body.data;

    const res = await del(`/api/tasks/${task._id}`, { token: employee.token });
    assert.equal(res.status, 403);
  });
});
