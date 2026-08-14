import { ApiError } from '../utils/ApiError.js';

/**
 * Validates `req[source]` against a zod schema and replaces it with the parsed
 * result, so controllers only ever see coerced, trusted values.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(ApiError.badRequest(details[0]?.message || 'Invalid request data', details));
    }

    // req.query is a getter in Express 5; assigning to a local copy keeps this portable.
    if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    return next();
  };
