import { ROLES, USER_STATUS } from '../config/constants.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/token.js';

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password — no account enumeration.
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const passwordMatches = await user.verifyPassword(password);
  if (!passwordMatches) throw ApiError.unauthorized('Invalid email or password');

  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Your account is inactive. Please contact an administrator.');
  }

  return { token: signAccessToken(user), user: user.toJSON() };
};

/**
 * Registration bootstraps the very first admin when the database is empty.
 * Once any user exists it becomes an admin-only operation, which keeps the public
 * endpoint from being used to mint accounts.
 */
export const register = async (payload, requestingUser) => {
  // countDocuments, not estimatedDocumentCount: the estimate reads cached collection
  // metadata that can be stale, and "is the system empty" decides whether this
  // endpoint is open to the public.
  const userCount = await User.countDocuments({});
  const isBootstrap = userCount === 0;

  if (!isBootstrap && requestingUser?.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an administrator can create accounts');
  }

  const existing = await User.findOne({ email: payload.email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    passwordHash: await User.hashPassword(payload.password),
    department: payload.department || 'other',
    // The bootstrap account is always an admin; afterwards an admin chooses the role.
    role: isBootstrap ? ROLES.ADMIN : payload.role || ROLES.EMPLOYEE,
    status: USER_STATUS.ACTIVE,
  });

  return { token: signAccessToken(user), user: user.toJSON() };
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found');

  const matches = await user.verifyPassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
};

export const updateProfile = async (userId, payload) => {
  const user = await User.findByIdAndUpdate(userId, payload, {
    new: true,
    runValidators: true,
  });
  if (!user) throw ApiError.notFound('Account not found');
  return user.toJSON();
};
