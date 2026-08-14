import { Router } from 'express';
import { z } from 'zod';
import * as notificationController from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { booleanFlag, idParams, paginationQuery } from '../validators/common.js';

const router = Router();

// Every route is scoped to the signed-in user inside the service — there is no
// way to read or modify another person's notifications.
router.use(requireAuth);

const listQuerySchema = z.object({ unread: booleanFlag, ...paginationQuery });

router.get('/', validate(listQuerySchema, 'query'), notificationController.listNotifications);
router.get('/unread-count', notificationController.unreadCount);
router.post('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', validate(idParams, 'params'), notificationController.markAsRead);

export default router;
