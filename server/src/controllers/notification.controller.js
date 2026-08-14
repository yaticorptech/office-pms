import * as notificationService from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const { data, meta } = await notificationService.listNotifications(
    req.user._id,
    req.validatedQuery,
  );
  res.json({ success: true, data, meta });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  res.json({ success: true, data: { unreadCount: count } });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAsRead(req.user._id, req.params.id);
  res.json({ success: true, data });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.user._id);
  res.json({ success: true, message: 'All notifications marked as read', data });
});
