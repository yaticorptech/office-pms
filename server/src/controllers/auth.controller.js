import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({ success: true, message: 'Signed in successfully', data: result });
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req.user);
  res.status(201).json({ success: true, message: 'Account created successfully', data: result });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  res.json({ success: true, message: 'Profile updated successfully', data: user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body);
  res.json({ success: true, message: 'Password changed successfully' });
});
