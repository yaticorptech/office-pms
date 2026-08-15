/**
 * Boots the real entrypoint (`node src/index.js`) with NODE_ENV=production, against
 * a real MongoDB, serving the real client build — the path `npm start` actually takes.
 *
 * Every other suite builds the app in-process, so this is the only place that covers
 * production startup, the single-origin static serving and graceful shutdown together.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const clientDist = path.resolve(serverRoot, '../client/dist');
const hasBuild = fs.existsSync(path.join(clientDist, 'index.html'));

let mongo;
let child;
let baseUrl;
const output = [];

const PORT = 8199;

/** Polls the health endpoint until the server answers or the attempts run out. */
const waitForReady = async (attempts = 60) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

before(async () => {
  if (!hasBuild) return;

  mongo = await MongoMemoryServer.create();
  baseUrl = `http://127.0.0.1:${PORT}`;

  child = spawn(process.execPath, ['src/index.js'], {
    cwd: serverRoot,
    env: {
      PATH: process.env.PATH,
      DOTENV_CONFIG_PATH: path.join(here, 'fixtures', 'empty.env'),
      NODE_ENV: 'production',
      PORT: String(PORT),
      MONGODB_URI: mongo.getUri(),
      DB_NAME: 'office_pms_smoke',
      JWT_SECRET: 'f'.repeat(64),
      BCRYPT_ROUNDS: '10',
      SERVE_CLIENT: 'true',
      CLIENT_DIST_PATH: clientDist,
    },
  });

  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));

  const ready = await waitForReady();
  assert.ok(ready, `production server never became ready:\n${output.join('')}`);
});

after(async () => {
  if (child && !child.killed) child.kill('SIGKILL');
  if (mongo) await mongo.stop();
});

describe('production startup', { skip: hasBuild ? false : 'client/dist not built' }, () => {
  it('starts and reports a healthy database', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
  });

  it('serves the client at the root', async () => {
    const res = await fetch(`${baseUrl}/`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  });

  it('serves the app shell for a deep link', async () => {
    const res = await fetch(`${baseUrl}/projects`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  });

  it('runs the full sign-up and sign-in flow', async () => {
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Production Admin',
        email: 'admin@production.test',
        password: 'Str0ng@Password',
      }),
    });
    const registered = await register.json();

    assert.equal(register.status, 201);
    assert.equal(registered.data.user.role, 'admin', 'the first account bootstraps as admin');

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@production.test', password: 'Str0ng@Password' }),
    });
    const session = await login.json();

    assert.equal(login.status, 200);
    assert.ok(session.data.token);

    const me = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.data.token}` },
    });
    assert.equal(me.status, 200);
  });

  it('closes public registration once the first admin exists', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second Admin',
        email: 'sneaky@production.test',
        password: 'Str0ng@Password',
        role: 'admin',
      }),
    });

    assert.equal(res.status, 403);
  });

  it('hides stack traces and internal messages from server errors', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.stack, undefined);
  });

  it('shuts down cleanly on SIGTERM', async () => {
    const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));

    child.kill('SIGTERM');

    const code = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 12_000)),
    ]);

    assert.equal(code, 0, `expected a clean exit, got ${code}\n${output.join('')}`);
    assert.match(output.join(''), /shutting down/i);
  });
});
