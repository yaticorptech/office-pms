import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { mountClient } from './client.js';
import { env, isProduction, isTest } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import routes from './routes/index.js';
import { ApiError } from './utils/ApiError.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  // Without this the client IP behind a load balancer is the proxy's, which would
  // make rate limiting apply to every user as a single caller.
  if (env.trustProxy !== false) app.set('trust proxy', env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // The bundle and stylesheet are same-origin; the favicon is a data: URI.
          'img-src': ["'self'", 'data:', 'https:'],
          // Extra hosts are needed only when the page talks to an API elsewhere.
          'connect-src': ["'self'", ...env.cspConnectSrc],
          // No inline <script> in the build, so this stays strict.
          'script-src': ["'self'"],
          'upgrade-insecure-requests': isProduction ? [] : null,
        },
      },
      // Left off (helmet's own default) — requiring CORP on every subresource buys
      // nothing here and breaks any future third-party embed, e.g. profile photos
      // served from another host.
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin and tooling requests arrive without an Origin header.
        if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
        // A disallowed origin is a rejected caller, not a server fault — without an
        // explicit status this would surface as a 500 and be logged as a crash.
        return callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (!isTest) app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.use('/api', apiLimiter, routes);

  if (env.serveClient) mountClient(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
