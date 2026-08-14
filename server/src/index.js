import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

const start = async () => {
  try {
    await connectDatabase();

    const app = createApp();
    const server = app.listen(env.port, () => {
      console.log(`✔ API listening on http://localhost:${env.port}/api`);
      console.log(`  Allowed client origins: ${env.clientOrigins.join(', ')}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} received — shutting down.`);
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('✖ Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
