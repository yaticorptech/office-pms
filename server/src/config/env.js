import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '../..');

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
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

  jwtSecret: process.env.JWT_SECRET || 'office-pms-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 10),

  seedAdminName: process.env.SEED_ADMIN_NAME || 'Admin User',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@office.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  seedEmployeePassword: process.env.SEED_EMPLOYEE_PASSWORD || 'Employee@123',
};

export const isProduction = env.nodeEnv === 'production';

if (isProduction && env.jwtSecret === 'office-pms-dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a strong unique value in production.');
}

if (isProduction && !env.mongodbUri) {
  throw new Error('MONGODB_URI must be set in production.');
}
