import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';

/** How long to let in-flight requests finish before the process is forced down. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const start = async () => {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`✔ API listening on port ${env.port} (${env.nodeEnv})`);
    if (env.serveClient) console.log(`  Serving the client build from ${env.clientDistPath}`);
    else console.log(`  Allowed client origins: ${env.clientOrigins.join(', ')}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`✖ Port ${env.port} is already in use.`);
    } else {
      console.error('✖ Server error:', error);
    }
    process.exit(1);
  });

  let shuttingDown = false;

  const shutdown = async (signal, exitCode = 0) => {
    // A second Ctrl-C (or a signal arriving mid-shutdown) must not start over.
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — shutting down.`);

    // A connection that never closes must not keep the process alive forever;
    // the platform would eventually SIGKILL it anyway, mid-write.
    const forceExit = setTimeout(() => {
      console.error('✖ Shutdown timed out — forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
      process.exit(exitCode);
    } catch (error) {
      console.error('✖ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // An unhandled rejection leaves the process in an unknown state. Closing down
  // cleanly lets the platform restart a healthy one instead of serving from a
  // half-broken instance.
  process.on('unhandledRejection', (reason) => {
    console.error('✖ Unhandled promise rejection:', reason);
    shutdown('unhandledRejection', 1);
  });

  process.on('uncaughtException', (error) => {
    console.error('✖ Uncaught exception:', error);
    shutdown('uncaughtException', 1);
  });
};

start().catch((error) => {
  console.error('✖ Failed to start server:', error.message);
  process.exit(1);
});
