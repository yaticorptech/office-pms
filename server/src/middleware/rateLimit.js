import rateLimit, { MemoryStore } from 'express-rate-limit';
import { env } from '../config/env.js';

// Kept so the test suite can clear counters between cases; in production these
// simply hold the sliding windows for the process's lifetime.
const stores = [];

/** Answers in the same `{ success, message }` envelope as every other error. */
const jsonHandler = (message) => (_req, res, _next, options) => {
  res.status(options.statusCode).json({ success: false, message });
};

const passthrough = (_req, _res, next) => next();

const build = (options) => {
  if (!env.rateLimit.enabled) return passthrough;

  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({ ...options, store });
};

/**
 * Clears every counter. Only used by tests — each case needs a fresh window, or
 * one suite's failed sign-ins would throttle the next.
 */
export const resetRateLimits = () => Promise.all(stores.map((store) => store.resetAll()));

/** Broad ceiling so one client cannot flood the API. Generous for normal use. */
export const apiLimiter = build({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Too many requests. Please wait a moment and try again.'),
});

/**
 * Tight limit on credential endpoints — without it, sign-in is open to offline-speed
 * password guessing. Successful sign-ins are not counted, so a busy office never
 * trips it; only repeated failures from one address do.
 */
export const authLimiter = build({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Too many failed attempts. Please wait a few minutes and try again.'),
});
