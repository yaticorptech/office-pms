import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdmin,
  createProject,
  createTask,
  createUser,
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

beforeEach(async () => {
  admin = await createAdmin({ email: 'admin@office.test', name: 'Admin User' });
  employee = await createUser({ email: 'employee@office.test', name: 'Priya Sharma' });
});

describe('GET /api/employees', () => {
  it('is admin-only', async () => {
    const res = await get('/api/employees', { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('lists employees with task counts for an admin', async () => {
    const project = (await createProject(admin.token, { name: 'Project One', owner: admin.id })).body.data;
    await createTask(admin.token, { title: 'Task One', project: project._id, assignedTo: employee.id });
    await createTask(admin.token, {
      title: 'Task Two', project: project._id, assignedTo: employee.id, status: 'completed',
    });

    const res = await get('/api/employees', { token: admin.token });

    assert.equal(res.status, 200);
    const priya = res.body.data.find((user) => user.email === 'employee@office.test');
    assert.equal(priya.totalTasks, 2);
    assert.equal(priya.completedTasks, 1);
    assert.equal(priya.activeTasks, 1);
  });

  it('never includes the password hash', async () => {
    const res = await get('/api/employees', { token: admin.token });

    assert.equal(res.status, 200);
    assert.ok(!JSON.stringify(res.body).includes('$2'), 'no bcrypt hash in the list payload');
    assert.ok(res.body.data.every((user) => user.passwordHash === undefined));
  });

  it('filters by department, role and status', async () => {
    await createUser({ email: 'sales@office.test', department: 'sales' });
    await createUser({ email: 'gone@office.test', status: 'inactive' });

    const byDepartment = await get('/api/employees?department=sales', { token: admin.token });
    const byRole = await get('/api/employees?role=admin', { token: admin.token });
    const byStatus = await get('/api/employees?status=inactive', { token: admin.token });

    assert.equal(byDepartment.body.data.length, 1);
    assert.equal(byRole.body.data.length, 1);
    assert.equal(byStatus.body.data.length, 1);
  });

  it('searches across name and email', async () => {
    const byName = await get('/api/employees?search=Priya', { token: admin.token });
    const byEmail = await get('/api/employees?search=employee@', { token: admin.token });

    assert.equal(byName.body.data.length, 1);
    assert.equal(byEmail.body.data.length, 1);
  });
});

describe('GET /api/employees/assignable', () => {
  it('is readable by any signed-in user', async () => {
    const res = await get('/api/employees/assignable', { token: employee.token });
    assert.equal(res.status, 200);
  });

  it('excludes inactive accounts', async () => {
    await createUser({ email: 'gone@office.test', status: 'inactive' });

    const res = await get('/api/employees/assignable', { token: employee.token });

    assert.equal(res.body.data.length, 2, 'only the two active accounts');
    assert.ok(!res.body.data.some((user) => user.email === 'gone@office.test'));
  });

  it('exposes only the fields a dropdown needs', async () => {
    const res = await get('/api/employees/assignable', { token: employee.token });

    const [user] = res.body.data;
    assert.ok(user.name && user.email);
    assert.equal(user.passwordHash, undefined);
    assert.equal(user.status, undefined, 'no status, createdAt or other internals');
  });

  it('requires authentication', async () => {
    const res = await get('/api/employees/assignable');
    assert.equal(res.status, 401);
  });
});

describe('POST /api/employees', () => {
  it('creates an employee as an admin', async () => {
    const res = await post(
      '/api/employees',
      {
        name: 'New Hire',
        email: 'newhire@office.test',
        password: 'Password@123',
        department: 'marketing',
      },
      { token: admin.token },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'employee');
    assert.equal(res.body.data.passwordHash, undefined);
  });

  it('refuses a non-admin', async () => {
    const res = await post(
      '/api/employees',
      { name: 'X', email: 'x@office.test', password: 'Password@123', department: 'sales' },
      { token: employee.token },
    );
    assert.equal(res.status, 403);
  });

  it('rejects a duplicate email', async () => {
    const res = await post(
      '/api/employees',
      {
        name: 'Clash', email: 'employee@office.test', password: 'Password@123', department: 'sales',
      },
      { token: admin.token },
    );

    assert.equal(res.status, 409);
  });

  it('requires a department', async () => {
    const res = await post(
      '/api/employees',
      { name: 'No Dept', email: 'nodept@office.test', password: 'Password@123' },
      { token: admin.token },
    );

    assert.equal(res.status, 400);
  });

  it('lets the new account sign in', async () => {
    await post(
      '/api/employees',
      {
        name: 'Sign In', email: 'signin@office.test', password: 'Password@123', department: 'hr',
      },
      { token: admin.token },
    );

    const login = await post('/api/auth/login', {
      email: 'signin@office.test',
      password: 'Password@123',
    });

    assert.equal(login.status, 200);
  });
});

describe('PUT /api/employees/:id', () => {
  it('updates only the fields provided', async () => {
    const res = await put(
      `/api/employees/${employee.id}`,
      { department: 'finance' },
      { token: admin.token },
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.department, 'finance');
    assert.equal(res.body.data.name, 'Priya Sharma', 'name is untouched');
  });

  it('rejects an empty body', async () => {
    const res = await put(`/api/employees/${employee.id}`, {}, { token: admin.token });
    assert.equal(res.status, 400);
  });

  it('rejects an email that belongs to someone else', async () => {
    const res = await put(
      `/api/employees/${employee.id}`,
      { email: 'admin@office.test' },
      { token: admin.token },
    );

    assert.equal(res.status, 409);
  });

  it('changes the password and lets the new one sign in', async () => {
    const res = await put(
      `/api/employees/${employee.id}`,
      { password: 'Rotated@456' },
      { token: admin.token },
    );
    assert.equal(res.status, 200);

    const login = await post('/api/auth/login', {
      email: 'employee@office.test',
      password: 'Rotated@456',
    });
    assert.equal(login.status, 200);
  });

  it('refuses an admin changing their own role (business rule 9)', async () => {
    const res = await put(`/api/employees/${admin.id}`, { role: 'employee' }, { token: admin.token });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /own role/i);
  });

  it('refuses an admin deactivating themselves (business rule 9)', async () => {
    const res = await put(`/api/employees/${admin.id}`, { status: 'inactive' }, { token: admin.token });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /own account/i);
  });

  it('allows demoting an admin while another active admin remains', async () => {
    const secondAdmin = await createAdmin({ email: 'admin2@office.test' });

    const res = await put(`/api/employees/${admin.id}`, { role: 'employee' }, { token: secondAdmin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, 'employee');
  });

  it('always leaves at least one active admin standing (business rule 9)', async () => {
    // The two self-protection guards are what make this reachable over HTTP: an
    // admin cannot demote or deactivate themselves, and any other caller able to
    // perform the change is by definition another active admin.
    const { User } = await import('../src/models/User.js');

    const demoteSelf = await put(`/api/employees/${admin.id}`, { role: 'employee' }, { token: admin.token });
    assert.equal(demoteSelf.status, 400);

    const stillAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
    assert.ok(stillAdmins >= 1, 'the company is never left without an administrator');
  });

  it('returns 404 for an unknown employee', async () => {
    const res = await put(
      '/api/employees/507f1f77bcf86cd799439011',
      { name: 'Ghost' },
      { token: admin.token },
    );
    assert.equal(res.status, 404);
  });
});

describe('PATCH /api/employees/:id/status', () => {
  it('deactivates an employee', async () => {
    const res = await patch(
      `/api/employees/${employee.id}/status`,
      { status: 'inactive' },
      { token: admin.token },
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'inactive');
  });

  it('stops a deactivated employee signing in (business rule 5)', async () => {
    await patch(`/api/employees/${employee.id}/status`, { status: 'inactive' }, { token: admin.token });

    const login = await post('/api/auth/login', {
      email: 'employee@office.test',
      password: 'Password@123',
    });

    assert.equal(login.status, 403);
  });

  it('refuses an admin deactivating themselves (business rule 9)', async () => {
    const res = await patch(
      `/api/employees/${admin.id}/status`,
      { status: 'inactive' },
      { token: admin.token },
    );

    assert.equal(res.status, 400);
  });

  it('allows deactivating an admin while another active admin remains', async () => {
    const second = await createAdmin({ email: 'admin2@office.test' });

    const res = await patch(
      `/api/employees/${admin.id}/status`,
      { status: 'inactive' },
      { token: second.token },
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'inactive');
  });

  it('refuses deactivating the only remaining active admin (business rule 9)', async () => {
    // Reached at the service layer: an inactive admin could never authenticate to
    // make this call, so the guard is the backstop behind the self-protection rule.
    const { User } = await import('../src/models/User.js');
    const employeeService = await import('../src/services/employee.service.js');

    const soleAdmin = await createAdmin({ email: 'sole@office.test' });
    const staleActor = await User.findById(admin.id);
    await User.findByIdAndUpdate(admin.id, { status: 'inactive' });

    await assert.rejects(
      () => employeeService.setEmployeeStatus(soleAdmin.id, 'inactive', staleActor),
      /one active admin/i,
    );
  });

  it('rejects an invalid status', async () => {
    const res = await patch(
      `/api/employees/${employee.id}/status`,
      { status: 'on_holiday' },
      { token: admin.token },
    );
    assert.equal(res.status, 400);
  });
});

describe('GET /api/employees/:id', () => {
  it('returns the employee with their recent tasks and owned projects', async () => {
    const project = (await createProject(admin.token, { name: 'Owned', owner: employee.id })).body.data;
    await createTask(admin.token, { title: 'Theirs', project: project._id, assignedTo: employee.id });

    const res = await get(`/api/employees/${employee.id}`, { token: admin.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.recentTasks.length, 1);
    assert.equal(res.body.data.ownedProjects.length, 1);
    assert.equal(res.body.data.passwordHash, undefined);
  });

  it('is admin-only', async () => {
    const res = await get(`/api/employees/${employee.id}`, { token: employee.token });
    assert.equal(res.status, 403);
  });

  it('returns 404 for an unknown employee', async () => {
    const res = await get('/api/employees/507f1f77bcf86cd799439011', { token: admin.token });
    assert.equal(res.status, 404);
  });
});
