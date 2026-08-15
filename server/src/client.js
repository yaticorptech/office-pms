import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { env } from './config/env.js';

/**
 * Serves the built React app from this process, giving a single-origin deployment.
 *
 * Returns false (and warns) when no build is present, so the API still starts —
 * a missing `npm run build` should not take the whole service down.
 */
export const mountClient = (app) => {
  const indexFile = path.join(env.clientDistPath, 'index.html');

  if (!fs.existsSync(indexFile)) {
    console.warn(
      `⚠ SERVE_CLIENT is on but no client build was found at ${env.clientDistPath}.\n` +
        '  Run "npm run build" in client/, or set CLIENT_DIST_PATH. Serving the API only.',
    );
    return false;
  }

  app.use(
    express.static(env.clientDistPath, {
      // Vite fingerprints asset filenames, so they can be cached indefinitely.
      maxAge: '1y',
      immutable: true,
      // index.html is served by the fallback below, with its own caching rules.
      index: false,
    }),
  );

  /**
   * SPA fallback. Client-side routes like /tasks/123 are not files on disk, so any
   * GET that is not an API call renders the app shell and lets React Router take over.
   *
   * index.html itself must never be cached, or browsers would keep loading the
   * previous deploy's asset filenames after a release.
   */
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();
    if (path.extname(req.path)) return next(); // A missing asset should 404, not return HTML.

    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexFile);
  });

  return true;
};
