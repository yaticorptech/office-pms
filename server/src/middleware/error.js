import mongoose from 'mongoose';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/** Translates known error shapes into a consistent `{ message, details }` body. */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    details = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
    message = details[0]?.message || 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
    if (isProduction) message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(isProduction || statusCode < 500 ? {} : { stack: err.stack }),
  });
};
