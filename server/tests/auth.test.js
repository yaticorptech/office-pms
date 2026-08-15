import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdmin,
  createUser,
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

describe('POST /api/auth/login', () => {
  it('signs in with valid credentials and returns a token', async () => {
    const { user } = await createUser({ email: 'valid@office.test', password: 'Secret@123' });

    const res = await post('/api/auth/login', { email: 'valid@office.test', password: 'Secret@123' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'a token is returned');
    assert.equal(res.body.data.user.email, user.email);
  });

  it('never returns the password hash', async () => {
    await createUser({ email: 'hash@office.test', password: 'Secret@123' });
    const res = await post('/api/auth/login', { email: 'hash@office.test', password: 'Secret@123' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.ok(!JSON.stringify(res.body).includes('$2'), 'no bcrypt hash anywhere in the payload');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await createUser({ email: 'known@office.test', password: 'Secret@123' });

    const wrongPassword = await post('/api/auth/login', {
      email: 'known@office.test',
      password: 'WrongPassword@1',
    });
    const unknownEmail = await post('/api/auth/login', {
      email: 'nobody@office.test',
      password: 'Secret@123',
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(
      wrongPassword.body.message,
      unknownEmail.body.message,
      'identical message prevents account enumeration',
    );
  });

  it('refuses an inactive account', async () => {
    await createUser({ email: 'inactive@office.test', password: 'Secret@123', status: 'inactive' });

    const res = await post('/api/auth/login', {
      email: 'inactive@office.test',
      password: 'Secret@123',
    });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /inactive/i);
  });

  it('matches the email case-insensitively', async () => {
    await createUser({ email: 'case@office.test', password: 'Secret@123' });
    const res = await post('/api/auth/login', { email: 'CASE@Office.Test', password: 'Secret@123' });
    assert.equal(res.status, 200);
  });

  it('rejects a malformed body with field-level details', async () => {
    const res = await post('/api/auth/login', { email: 'not-an-email', password: '' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(Array.isArray(res.body.details));
    assert.ok(res.body.details.some((detail) => detail.field === 'email'));
  });

  it('is not fooled by a NoSQL operator in place of a string', async () => {
    await createUser({ email: 'nosql@office.test', password: 'Secret@123' });

    const res = await post('/api/auth/login', {
      email: { $ne: null },
      password: { $ne: null },
    });

    assert.equal(res.status, 400, 'the object is rejected by validation, never reaching the query');
  });
});

describe('POST /api/auth/register', () => {
  it('bootstraps the first account as an admin when the database is empty', async () => {
    const res = await post('/api/auth/register', {
      name: 'First Admin',
      email: 'first@office.test',
      password: 'Password@123',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'admin', 'the bootstrap account is always an admin');
    assert.ok(res.body.data.token);
  });

  it('ignores a requested employee role during bootstrap', async () => {
    const res = await post('/api/auth/register', {
      name: 'First Admin',
      email: 'first@office.test',
      password: 'Password@123',
      role: 'employee',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'admin');
  });

  it('closes to the public once any user exists', async () => {
    await createUser({ email: 'existing@office.test' });

    const res = await post('/api/auth/register', {
      name: 'Sneaky Admin',
      email: 'sneaky@office.test',
      password: 'Password@123',
      role: 'admin',
    });

    assert.equal(res.status, 403, 'anonymous registration is refused once the system is seeded');
  });

  it('refuses an employee trying to create an account', async () => {
    const employee = await createUser();

    const res = await post(
      '/api/auth/register',
      { name: 'New Person', email: 'new@office.test', password: 'Password@123' },
      { token: employee.token },
    );

    assert.equal(res.status, 403);
  });

  it('lets an admin create an account', async () => {
    const admin = await createAdmin();

    const res = await post(
      '/api/auth/register',
      { name: 'New Person', email: 'new@office.test', password: 'Password@123' },
      { token: admin.token },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'employee', 'defaults to employee, not admin');
  });

  it('rejects a duplicate email', async () => {
    const admin = await createAdmin({ email: 'admin@office.test' });

    const res = await post(
      '/api/auth/register',
      { name: 'Clash', email: 'admin@office.test', password: 'Password@123' },
      { token: admin.token },
    );

    assert.equal(res.status, 409);
  });

  it('enforces the minimum password length', async () => {
    const res = await post('/api/auth/register', {
      name: 'Short Password',
      email: 'short@office.test',
      password: 'abc',
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /8 characters/i);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request with no token', async () => {
    const res = await get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('rejects a malformed token', async () => {
    const res = await get('/api/auth/me', { token: 'not-a-real-jwt' });
    assert.equal(res.status, 401);
  });

  it('rejects a token signed with a different secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { user } = await createUser();
    const forged = jwt.sign({ sub: String(user._id), role: 'admin' }, 'a-different-secret');

    const res = await get('/api/auth/me', { token: forged });
    assert.equal(res.status, 401);
  });

  it('returns the signed-in user without the password hash', async () => {
    const { user, token } = await createUser({ email: 'me@office.test' });

    const res = await get('/api/auth/me', { token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, user.email);
    assert.equal(res.body.data.passwordHash, undefined);
  });

  it('stops accepting an existing token as soon as the account is deactivated', async () => {
    const admin = await createAdmin();
    const employee = await createUser({ email: 'revoked@office.test' });

    assert.equal((await get('/api/auth/me', { token: employee.token })).status, 200);

    await import('../src/models/User.js').then(({ User }) =>
      User.findByIdAndUpdate(employee.id, { status: 'inactive' }),
    );

    const res = await get('/api/auth/me', { token: employee.token });
    assert.equal(res.status, 403, 'the user is re-read on every request, so revocation is immediate');
    assert.ok(admin.token);
  });

  it('stops accepting a token for a deleted account', async () => {
    const employee = await createUser();
    await import('../src/models/User.js').then(({ User }) => User.findByIdAndDelete(employee.id));

    const res = await get('/api/auth/me', { token: employee.token });
    assert.equal(res.status, 401);
  });
});

describe('PUT /api/auth/me', () => {
  it('updates the display name', async () => {
    const { token } = await createUser({ name: 'Old Name' });

    const res = await put('/api/auth/me', { name: 'New Name' }, { token });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'New Name');
  });

  it('cannot be used to escalate role or reactivate an account', async () => {
    const { token, id } = await createUser({ name: 'Regular', role: 'employee' });

    const res = await put(
      '/api/auth/me',
      { name: 'Regular', role: 'admin', status: 'inactive', email: 'hijack@office.test' },
      { token },
    );

    assert.equal(res.status, 200);

    const { User } = await import('../src/models/User.js');
    const stored = await User.findById(id);
    assert.equal(stored.role, 'employee', 'role is not writable through the profile endpoint');
    assert.equal(stored.status, 'active');
    assert.notEqual(stored.email, 'hijack@office.test', 'email is not writable here either');
  });
});

describe('POST /api/auth/change-password', () => {
  it('rejects an incorrect current password', async () => {
    const { token } = await createUser({ password: 'Current@123' });

    const res = await post(
      '/api/auth/change-password',
      { currentPassword: 'Wrong@123', newPassword: 'Brand@New1' },
      { token },
    );

    assert.equal(res.status, 400);
  });

  it('changes the password and invalidates the old one', async () => {
    const { token } = await createUser({ email: 'change@office.test', password: 'Current@123' });

    const change = await post(
      '/api/auth/change-password',
      { currentPassword: 'Current@123', newPassword: 'Brand@New1' },
      { token },
    );
    assert.equal(change.status, 200);

    const oldLogin = await post('/api/auth/login', {
      email: 'change@office.test',
      password: 'Current@123',
    });
    const newLogin = await post('/api/auth/login', {
      email: 'change@office.test',
      password: 'Brand@New1',
    });

    assert.equal(oldLogin.status, 401);
    assert.equal(newLogin.status, 200);
  });

  it('enforces the password policy on the new password', async () => {
    const { token } = await createUser({ password: 'Current@123' });

    const res = await post(
      '/api/auth/change-password',
      { currentPassword: 'Current@123', newPassword: 'short' },
      { token },
    );

    assert.equal(res.status, 400);
  });
});
