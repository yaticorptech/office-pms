/**
 * Test harness: boots an in-memory MongoDB and a real HTTP server, then talks to
 * it over the wire with fetch. Nothing is stubbed, so the tests exercise routing,
 * validation, auth middleware and the error handler exactly as production does.
 *
 * Environment is fixed here, before any `src/` module is imported, because
 * `config/env.js` reads process.env at import time. Every key the app reads is set
 * explicitly so a developer's `server/.env` cannot change test behaviour.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4'; // Keeps hashing fast; production uses the real cost.
process.env.MONGODB_URI = '';
process.env.USE_EMBEDDED_MONGO = 'false';
process.env.DB_NAME = 'office_pms_test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.SERVE_CLIENT = 'false';

import { once } from 'node:events';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo;
let server;
let baseUrl;

/** Starts Mongo + the API once per test file. Returns the API base URL. */
export const startTestServer = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: process.env.DB_NAME });

  const { createApp } = await import('../../src/app.js');
  server = createApp().listen(0);
  await once(server, 'listening');

  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
};

export const stopTestServer = async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
};

/** Drops every document between tests so each case starts from a known state. */
export const resetDatabase = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

/**
 * Single request helper. Always parses the JSON envelope and never throws on a
 * non-2xx, so tests can assert on status and body together.
 */
export const request = async (method, path, { token, body, headers = {}, raw } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, body: payload, headers: response.headers };
};

export const get = (path, options) => request('GET', path, options);
export const post = (path, body, options) => request('POST', path, { ...options, body });
export const put = (path, body, options) => request('PUT', path, { ...options, body });
export const patch = (path, body, options) => request('PATCH', path, { ...options, body });
export const del = (path, options) => request('DELETE', path, options);

// ── Fixtures ──────────────────────────────────────────────────────────────────

let userCounter = 0;

/**
 * Creates a user directly through the model and signs a token for them, so tests
 * that need an actor do not have to go through the HTTP login flow every time.
 */
export const createUser = async ({
  name = 'Test User',
  email,
  password = 'Password@123',
  role = 'employee',
  department = 'technology',
  status = 'active',
} = {}) => {
  const { User } = await import('../../src/models/User.js');
  const { signAccessToken } = await import('../../src/utils/token.js');

  userCounter += 1;
  const user = await User.create({
    name,
    email: email || `user${userCounter}@office.test`,
    passwordHash: await User.hashPassword(password),
    role,
    department,
    status,
  });

  return { user, id: String(user._id), token: signAccessToken(user), password };
};

export const createAdmin = (overrides = {}) =>
  createUser({ name: 'Admin User', role: 'admin', ...overrides });

/** Days from now as a Date — negative for the past. */
export const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** Creates a project over HTTP so the full validation path is exercised. */
export const createProject = async (token, overrides = {}) => {
  const response = await post(
    '/api/projects',
    {
      name: 'Test Project',
      owner: overrides.owner,
      startDate: daysFromNow(-10).toISOString(),
      ...overrides,
    },
    { token },
  );
  return response;
};

export const createTask = async (token, overrides = {}) => {
  const response = await post(
    '/api/tasks',
    { title: 'Test Task', ...overrides },
    { token },
  );
  return response;
};
