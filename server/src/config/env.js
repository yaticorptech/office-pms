import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(serverRoot, '..');

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const nodeEnv = process.env.NODE_ENV || 'development';

export const isProduction = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';

const DEV_JWT_SECRET = 'office-pms-dev-secret-change-me';

/**
 * `trust proxy` tells Express to read the client IP from X-Forwarded-For. It must
 * be the number of proxies actually in front of the app: too low and rate limits
 * apply to the proxy's IP for everyone, too high and a client can spoof its own IP.
 * Most platforms (Render, Railway, Fly, Heroku, a single nginx) sit at 1 hop.
 */
const parseTrustProxy = (value) => {
  if (value === undefined || value === '') return isProduction ? 1 : false;
  if (['true', 'false'].includes(value.toLowerCase())) return value.toLowerCase() === 'true';
  const hops = Number.parseInt(value, 10);
  return Number.isNaN(hops) ? value : hops;
};

export const env = {
  nodeEnv,
  port: int(process.env.PORT, 8090),
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  dbName: process.env.DB_NAME || 'office_pms',

  /**
   * When no MONGODB_URI is configured we boot an embedded MongoDB (downloaded once
   * by mongodb-memory-server) whose data files live on disk, so the app runs with
   * zero database setup while still behaving like a normal persistent Mongo.
   */
  useEmbeddedMongo: bool(process.env.USE_EMBEDDED_MONGO, true),
  embeddedMongoPath: process.env.EMBEDDED_MONGO_PATH || path.join(serverRoot, '.data/mongo'),

  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  jwtSecret: process.env.JWT_SECRET || DEV_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 10),

  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  /**
   * Serving the built client from the API gives a single-origin deployment: no CORS,
   * no second host, and deep links work through the SPA fallback. Turn it off when
   * the frontend is hosted separately (Netlify, Vercel, a CDN).
   */
  serveClient: bool(process.env.SERVE_CLIENT, isProduction),
  clientDistPath: process.env.CLIENT_DIST_PATH
    ? path.resolve(process.env.CLIENT_DIST_PATH)
    : path.join(repoRoot, 'client/dist'),
  /** Extra origins the browser may call from the served page, e.g. a split API host. */
  cspConnectSrc: (process.env.CSP_CONNECT_SRC || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),

  rateLimit: {
    // Off under test so the suite is not throttled; a dedicated test turns it on.
    enabled: bool(process.env.RATE_LIMIT_ENABLED, !isTest),
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: int(process.env.RATE_LIMIT_MAX, 600),
    authWindowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    authMax: int(process.env.AUTH_RATE_LIMIT_MAX, 10),
  },

  seedAdminName: process.env.SEED_ADMIN_NAME || 'Admin User',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@office.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  seedEmployeePassword: process.env.SEED_EMPLOYEE_PASSWORD || 'Employee@123',
};

/**
 * Fail fast rather than boot a production process that is quietly insecure.
 * Every check here is something that cannot be safely defaulted.
 */
if (isProduction) {
  const failures = [];

  if (env.jwtSecret === DEV_JWT_SECRET) {
    failures.push('JWT_SECRET must be set to a strong unique value (openssl rand -hex 32).');
  }
  if (env.jwtSecret.length < 32) {
    failures.push('JWT_SECRET must be at least 32 characters.');
  }
  if (!env.mongodbUri) {
    failures.push('MONGODB_URI must be set — the embedded database is for development only.');
  }
  if (env.bcryptRounds < 10) {
    failures.push('BCRYPT_ROUNDS must be at least 10.');
  }
  if (!env.serveClient && env.clientOrigins.some((origin) => origin.includes('localhost'))) {
    failures.push(
      'CLIENT_ORIGIN still points at localhost. Set it to the real frontend origin, ' +
        'or enable SERVE_CLIENT to serve the built client from this process.',
    );
  }

  if (failures.length > 0) {
    throw new Error(`Refusing to start in production:\n  - ${failures.join('\n  - ')}`);
  }
}
