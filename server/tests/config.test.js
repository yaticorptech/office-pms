/**
 * The production guards in config/env.js are the difference between a deployment
 * that is misconfigured and one that is quietly insecure, so they are worth
 * testing directly. Each case loads the module in a child process, because the
 * checks run once at import time.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

const STRONG_SECRET = 'a'.repeat(64);

/** Loads config/env.js with a clean environment plus the given overrides. */
const loadEnv = async (overrides = {}) => {
  try {
    const { stdout } = await run(
      process.execPath,
      ['-e', 'import("./src/config/env.js").then(() => console.log("started"))'],
      {
        cwd: serverRoot,
        env: {
          PATH: process.env.PATH,
          // dotenv would otherwise load the developer's real server/.env on top.
          DOTENV_CONFIG_PATH: path.join(here, 'fixtures', 'empty.env'),
          ...overrides,
        },
      },
    );
    return { started: stdout.includes('started'), error: null };
  } catch (error) {
    return { started: false, error: `${error.stderr}${error.stdout}` };
  }
};

describe('production configuration guards', () => {
  it('refuses to start with the development JWT secret', async () => {
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      JWT_SECRET: 'office-pms-dev-secret-change-me',
    });

    assert.equal(result.started, false);
    assert.match(result.error, /JWT_SECRET must be set/);
  });

  it('refuses to start with a short JWT secret', async () => {
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      JWT_SECRET: 'too-short',
    });

    assert.equal(result.started, false);
    assert.match(result.error, /at least 32 characters/);
  });

  it('refuses to start without a database URI', async () => {
    const result = await loadEnv({ NODE_ENV: 'production', JWT_SECRET: STRONG_SECRET });

    assert.equal(result.started, false);
    assert.match(result.error, /MONGODB_URI must be set/);
  });

  it('refuses to start with a weak bcrypt cost', async () => {
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      JWT_SECRET: STRONG_SECRET,
      BCRYPT_ROUNDS: '4',
    });

    assert.equal(result.started, false);
    assert.match(result.error, /BCRYPT_ROUNDS/);
  });

  it('refuses to start when CLIENT_ORIGIN still points at localhost', async () => {
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      JWT_SECRET: STRONG_SECRET,
      SERVE_CLIENT: 'false',
      CLIENT_ORIGIN: 'http://localhost:5173',
    });

    assert.equal(result.started, false);
    assert.match(result.error, /CLIENT_ORIGIN/);
  });

  it('reports every problem at once rather than one per restart', async () => {
    const result = await loadEnv({ NODE_ENV: 'production' });

    assert.equal(result.started, false);
    assert.match(result.error, /JWT_SECRET/);
    assert.match(result.error, /MONGODB_URI/);
  });

  it('starts when production is configured properly', async () => {
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net',
      JWT_SECRET: STRONG_SECRET,
      BCRYPT_ROUNDS: '12',
      SERVE_CLIENT: 'true',
    });

    assert.equal(result.started, true, result.error);
  });

  it('leaves development alone, so a fresh clone still runs with no setup', async () => {
    const result = await loadEnv({ NODE_ENV: 'development' });
    assert.equal(result.started, true, result.error);
  });

  it('starts in split-hosting mode when CLIENT_ORIGIN names the real frontend', async () => {
    // The topology used when the client is on Vercel and the API on Railway.
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net',
      JWT_SECRET: STRONG_SECRET,
      BCRYPT_ROUNDS: '12',
      SERVE_CLIENT: 'false',
      CLIENT_ORIGIN: 'https://office-pms.vercel.app',
      TRUST_PROXY: '1',
    });

    assert.equal(result.started, true, result.error);
  });

  it('accepts several comma-separated client origins', async () => {
    const result = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net',
      JWT_SECRET: STRONG_SECRET,
      BCRYPT_ROUNDS: '12',
      SERVE_CLIENT: 'false',
      CLIENT_ORIGIN: 'https://office-pms.vercel.app,https://pms.yaticorp.com',
    });

    assert.equal(result.started, true, result.error);
  });
});

describe('the seed script', () => {
  it('refuses to run against a production database', async () => {
    const result = await (async () => {
      try {
        const { stdout } = await run(process.execPath, ['src/seed/seed.js', '--fresh'], {
          cwd: serverRoot,
          env: {
            PATH: process.env.PATH,
            DOTENV_CONFIG_PATH: path.join(here, 'fixtures', 'empty.env'),
            NODE_ENV: 'production',
            MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net',
            JWT_SECRET: STRONG_SECRET,
            BCRYPT_ROUNDS: '12',
            SERVE_CLIENT: 'true',
          },
        });
        return { started: true, error: stdout };
      } catch (error) {
        return { started: false, error: `${error.stderr}${error.stdout}` };
      }
    })();

    assert.equal(result.started, false, 'seeding production must not be possible by accident');
    assert.match(result.error, /Refusing to seed/);
  });
});
