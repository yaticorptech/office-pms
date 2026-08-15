/**
 * Covers the single-origin deployment mode, where this process also serves the
 * built React app. The SPA fallback is what makes deep links like /tasks/123 work
 * on a hard refresh, so it is worth a test.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, startTestServer, stopTestServer } from './helpers/harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');
const hasBuild = fs.existsSync(path.join(clientDist, 'index.html'));

before(async () => {
  process.env.SERVE_CLIENT = 'true';
  process.env.CLIENT_DIST_PATH = clientDist;
  await startTestServer();
});

after(stopTestServer);

describe('serving the client build', { skip: hasBuild ? false : 'client/dist not built' }, () => {
  it('serves the app shell at the root', async () => {
    const res = await get('/');

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  });

  it('falls back to the app shell for a client-side route', async () => {
    const res = await get('/tasks/507f1f77bcf86cd799439011');

    assert.equal(res.status, 200, 'a hard refresh on a deep link must not 404');
    assert.match(res.headers.get('content-type'), /text\/html/);
  });

  it('never caches index.html, so a deploy is picked up immediately', async () => {
    const res = await get('/');
    assert.match(res.headers.get('cache-control'), /no-cache/);
  });

  it('caches fingerprinted assets aggressively', async () => {
    const assets = fs.readdirSync(path.join(clientDist, 'assets'));
    const bundle = assets.find((file) => file.endsWith('.js'));

    const res = await get(`/assets/${bundle}`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /max-age=31536000/);
  });

  it('404s a missing asset instead of returning HTML', async () => {
    const res = await get('/assets/does-not-exist.js');

    assert.equal(res.status, 404);
    assert.ok(
      !/text\/html/.test(res.headers.get('content-type') || ''),
      'returning the app shell for a missing script would break silently in the browser',
    );
  });

  it('still answers API routes normally', async () => {
    const res = await get('/api/health');

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });

  it('returns JSON, not HTML, for an unknown API route', async () => {
    const res = await get('/api/nope');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});
