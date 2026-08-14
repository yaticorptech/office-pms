import { ROLES, USER_STATUS } from '../config/constants.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/token.js';

const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
};

/**
 * Verifies the JWT and loads the user fresh from the database on every request, so
 * a deactivated or deleted account loses access immediately rather than at token expiry.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token is missing');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired or token is invalid');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Your account is inactive. Please contact an administrator.');
  }

  req.user = user;
  next();
});

export const requireRole =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    return next();
  };

export const requireAdmin = requireRole(ROLES.ADMIN);

/** Attaches the user when a token is present, but never rejects the request. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === USER_STATUS.ACTIVE) req.user = user;
  } catch {
    // An invalid token behaves the same as no token on optional routes.
  }
  return next();
});
