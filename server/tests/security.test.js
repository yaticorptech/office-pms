import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createAdmin,
  get,
  post,
  request,
  resetDatabase,
  startTestServer,
  stopTestServer,
} from './helpers/harness.js';

let baseUrl;

before(async () => {
  // Rate limiting is off by default under test so the other suites are not
  // throttled; this file turns it on with a low ceiling to prove it works.
  process.env.RATE_LIMIT_ENABLED = 'true';
  process.env.AUTH_RATE_LIMIT_MAX = '3';
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_MAX = '5000';
  baseUrl = await startTestServer();
});

after(stopTestServer);

beforeEach(async () => {
  await resetDatabase();
  // Each case needs a fresh window, or one test's failed sign-ins throttle the next.
  const { resetRateLimits } = await import('../src/middleware/rateLimit.js');
  await resetRateLimits();
});

describe('security headers', () => {
  it('does not advertise Express', async () => {
    const res = await get('/api/health');
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  it('sets the headers helmet is there for', async () => {
    const res = await get('/api/health');

    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'), 'a CSP is sent');
    assert.ok(res.headers.get('x-frame-options') || res.headers.get('content-security-policy'));
  });

  it('compresses a response large enough to be worth it', async () => {
    const admin = await createAdmin({ email: 'admin@office.test' });

    const encoding = await new Promise((resolve, reject) => {
      const url = new URL(`${baseUrl}/api/meta/options`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          headers: { 'Accept-Encoding': 'gzip', Authorization: `Bearer ${admin.token}` },
        },
        (res) => {
          res.resume();
          resolve(res.headers['content-encoding']);
        },
      );
      req.on('error', reject);
      req.end();
    });

    assert.equal(encoding, 'gzip');
  });
});

describe('CORS', () => {
  it('allows the configured client origin', async () => {
    const res = await get('/api/health', { headers: { Origin: 'http://localhost:5173' } });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  it('rejects an unknown origin with 403 rather than a server error', async () => {
    const res = await get('/api/health', { headers: { Origin: 'http://evil.example.com' } });

    assert.equal(res.status, 403, 'a disallowed origin is a rejected caller, not a crash');
  });

  it('allows a request with no Origin header (same-origin or server-to-server)', async () => {
    const res = await get('/api/health');
    assert.equal(res.status, 200);
  });
});

describe('rate limiting', () => {
  it('blocks repeated failed sign-in attempts', async () => {
    await createAdmin({ email: 'target@office.test', password: 'Correct@123' });

    const attempt = () =>
      post('/api/auth/login', { email: 'target@office.test', password: 'Wrong@123' });

    const first = await attempt();
    const second = await attempt();
    const third = await attempt();
    const fourth = await attempt();

    assert.equal(first.status, 401);
    assert.equal(second.status, 401);
    assert.equal(third.status, 401);
    assert.equal(fourth.status, 429, 'the fourth attempt inside the window is refused');
    assert.match(fourth.body.message, /too many/i);
    assert.equal(fourth.body.success, false, 'the standard error envelope is preserved');
  });

  it('does not count successful sign-ins toward the limit', async () => {
    await createAdmin({ email: 'busy@office.test', password: 'Correct@123' });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await post('/api/auth/login', {
        email: 'busy@office.test',
        password: 'Correct@123',
      });
      assert.equal(res.status, 200, `sign-in ${attempt + 1} still succeeds`);
    }
  });

  it('sends standard rate-limit headers', async () => {
    const res = await post('/api/auth/login', { email: 'x@office.test', password: 'Wrong@123' });
    assert.ok(res.headers.get('ratelimit') || res.headers.get('ratelimit-limit'));
  });
});

describe('request body limits', () => {
  it('rejects a body over the 1mb cap', async () => {
    const admin = await createAdmin({ email: 'admin@office.test' });
    const huge = JSON.stringify({ name: 'x'.repeat(2 * 1024 * 1024) });

    const res = await request('POST', '/api/projects', {
      token: admin.token,
      body: huge,
      raw: true,
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 413);
  });

  it('rejects malformed JSON with a 400, not a 500', async () => {
    const admin = await createAdmin({ email: 'admin@office.test' });

    const res = await request('POST', '/api/projects', {
      token: admin.token,
      body: '{"name": "unterminated',
      raw: true,
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 400);
  });
});

describe('health check', () => {
  it('reports ok with the database connected', async () => {
    const res = await get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.database, 'connected');
    assert.equal(typeof res.body.uptime, 'number');
  });

  it('needs no authentication', async () => {
    const res = await get('/api/health');
    assert.equal(res.status, 200);
  });
});

describe('meta and 404 handling', () => {
  it('serves the enum option lists without a token', async () => {
    const res = await get('/api/meta/options');

    assert.equal(res.status, 200);
    assert.ok(res.body.data.projectTypes.length > 0);
    assert.ok(res.body.data.departments.length > 0);
  });

  it('returns a JSON 404 for an unknown API route', async () => {
    const res = await get('/api/does-not-exist');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('never leaks a stack trace', async () => {
    const res = await get('/api/does-not-exist');
    assert.equal(res.body.stack, undefined);
  });
});
