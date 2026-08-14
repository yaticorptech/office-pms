import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from './env.js';

let embeddedServer = null;

// Fixed port so a second process (e.g. `npm run seed` while the API is running)
// can attach to the already-running embedded instance instead of fighting for
// the WiredTiger lock on the same data directory.
const EMBEDDED_PORT = 27018;
const EMBEDDED_URI = `mongodb://127.0.0.1:${EMBEDDED_PORT}`;

const isReachable = async (uri) => {
  try {
    const probe = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 1000 })
      .asPromise();
    await probe.close();
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolves the connection string. Falls back to an on-disk embedded MongoDB when
 * MONGODB_URI is not configured, so a fresh clone runs without installing Mongo.
 */
const resolveUri = async () => {
  if (env.mongodbUri) return { uri: env.mongodbUri, embedded: false };

  if (!env.useEmbeddedMongo) {
    throw new Error(
      'MONGODB_URI is not set. Either set it in server/.env or enable USE_EMBEDDED_MONGO=true.',
    );
  }

  if (await isReachable(EMBEDDED_URI)) {
    return { uri: EMBEDDED_URI, embedded: true, reused: true };
  }

  fs.mkdirSync(env.embeddedMongoPath, { recursive: true });

  // Imported lazily so production installs (without devDependencies) never need it.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  embeddedServer = await MongoMemoryServer.create({
    instance: {
      port: EMBEDDED_PORT,
      dbPath: env.embeddedMongoPath,
      storageEngine: 'wiredTiger',
    },
  });

  return { uri: embeddedServer.getUri(), embedded: true, reused: false };
};

export const connectDatabase = async () => {
  mongoose.set('strictQuery', true);

  const { uri, embedded, reused } = await resolveUri();
  await mongoose.connect(uri, {
    dbName: env.dbName,
    serverSelectionTimeoutMS: 15000,
  });

  const label = embedded
    ? `${reused ? 'running ' : ''}embedded MongoDB (${env.embeddedMongoPath})`
    : 'MongoDB';
  console.log(`✔ Connected to ${label} — database "${env.dbName}"`);

  return mongoose.connection;
};

export const disconnectDatabase = async () => {
  await mongoose.connection.close();
  if (embeddedServer) {
    await embeddedServer.stop();
    embeddedServer = null;
  }
};
