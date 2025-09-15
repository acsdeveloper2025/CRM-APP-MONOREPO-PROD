import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '@/middleware/auth';
import { validate } from '@/middleware/validation';
import { NotificationController } from '@/controllers/notificationController';

const router = Router();

// Validation schemas
const updatePreferencesValidation = [
  body('caseAssignmentEnabled').optional().isBoolean().withMessage('Case assignment enabled must be a boolean'),
  body('caseAssignmentPush').optional().isBoolean().withMessage('Case assignment push must be a boolean'),
  body('caseAssignmentWebsocket').optional().isBoolean().withMessage('Case assignment websocket must be a boolean'),
  body('caseReassignmentEnabled').optional().isBoolean().withMessage('Case reassignment enabled must be a boolean'),
  body('caseReassignmentPush').optional().isBoolean().withMessage('Case reassignment push must be a boolean'),
  body('caseReassignmentWebsocket').optional().isBoolean().withMessage('Case reassignment websocket must be a boolean'),
  body('caseCompletionEnabled').optional().isBoolean().withMessage('Case completion enabled must be a boolean'),
  body('caseCompletionPush').optional().isBoolean().withMessage('Case completion push must be a boolean'),
  body('caseCompletionWebsocket').optional().isBoolean().withMessage('Case completion websocket must be a boolean'),
  body('caseRevocationEnabled').optional().isBoolean().withMessage('Case revocation enabled must be a boolean'),
  body('caseRevocationPush').optional().isBoolean().withMessage('Case revocation push must be a boolean'),
  body('caseRevocationWebsocket').optional().isBoolean().withMessage('Case revocation websocket must be a boolean'),
  body('systemNotificationsEnabled').optional().isBoolean().withMessage('System notifications enabled must be a boolean'),
  body('systemNotificationsPush').optional().isBoolean().withMessage('System notifications push must be a boolean'),
  body('systemNotificationsWebsocket').optional().isBoolean().withMessage('System notifications websocket must be a boolean'),
  body('quietHoursEnabled').optional().isBoolean().withMessage('Quiet hours enabled must be a boolean'),
  body('quietHoursStart').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Quiet hours start must be in HH:MM format'),
  body('quietHoursEnd').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Quiet hours end must be in HH:MM format'),
];

const registerTokenValidation = [
  body('deviceId').trim().notEmpty().withMessage('Device ID is required'),
  body('platform').isIn(['ios', 'android', 'web']).withMessage('Platform must be ios, android, or web'),
  body('pushToken').trim().notEmpty().withMessage('Push token is required'),
];

const tokenIdValidation = [
  param('tokenId').isUUID().withMessage('Token ID must be a valid UUID'),
];

const testNotificationValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').optional().isString().withMessage('Type must be a string'),
  body('priority').optional().isIn(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).withMessage('Priority must be URGENT, HIGH, MEDIUM, or LOW'),
  body('targetUserId').optional().isUUID().withMessage('Target user ID must be a valid UUID'),
];

const notificationIdValidation = [
  param('notificationId').isUUID().withMessage('Notification ID must be a valid UUID'),
];

const getNotificationsValidation = [
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  body('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
  body('unreadOnly').optional().isBoolean().withMessage('Unread only must be a boolean'),
];

// Routes

/**
 * @route GET /api/notifications
 * @desc Get user's notifications
 * @access Private
 */
router.get('/',
  authenticateToken,
  NotificationController.getNotifications
);

/**
 * @route PUT /api/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:notificationId/read',
  authenticateToken,
  notificationIdValidation,
  validate,
  NotificationController.markNotificationAsRead
);

/**
 * @route PUT /api/notifications/mark-all-read
 * @desc Mark all notifications as read
 * @access Private
 */
router.put('/mark-all-read',
  authenticateToken,
  NotificationController.markAllNotificationsAsRead
);

/**
 * @route DELETE /api/notifications/:notificationId
 * @desc Delete a notification
 * @access Private
 */
router.delete('/:notificationId',
  authenticateToken,
  notificationIdValidation,
  validate,
  NotificationController.deleteNotification
);

/**
 * @route DELETE /api/notifications
 * @desc Clear all notifications
 * @access Private
 */
router.delete('/',
  authenticateToken,
  NotificationController.clearAllNotifications
);

/**
 * @route GET /api/notifications/preferences
 * @desc Get user's notification preferences
 * @access Private
 */
router.get('/preferences',
  authenticateToken,
  NotificationController.getNotificationPreferences
);

/**
 * @route PUT /api/notifications/preferences
 * @desc Update user's notification preferences
 * @access Private
 */
router.put('/preferences',
  authenticateToken,
  updatePreferencesValidation,
  validate,
  NotificationController.updateNotificationPreferences
);

/**
 * @route GET /api/notifications/tokens
 * @desc Get user's notification tokens
 * @access Private
 */
router.get('/tokens',
  authenticateToken,
  NotificationController.getNotificationTokens
);

/**
 * @route POST /api/notifications/tokens
 * @desc Register or update a notification token
 * @access Private
 */
router.post('/tokens',
  authenticateToken,
  registerTokenValidation,
  validate,
  NotificationController.registerNotificationToken
);

/**
 * @route DELETE /api/notifications/tokens/:tokenId
 * @desc Deactivate a notification token
 * @access Private
 */
router.delete('/tokens/:tokenId',
  authenticateToken,
  tokenIdValidation,
  validate,
  NotificationController.deactivateNotificationToken
);

/**
 * @route POST /api/notifications/test
 * @desc Send a test notification
 * @access Private
 */
router.post('/test',
  authenticateToken,
  testNotificationValidation,
  validate,
  NotificationController.sendTestNotification
);

/**
 * @route GET /api/notifications/analytics
 * @desc Get notification analytics
 * @access Private
 */
router.get('/analytics',
  authenticateToken,
  NotificationController.getNotificationAnalytics
);

/**
 * @route GET /api/notifications/:notificationId/delivery
 * @desc Get notification delivery status
 * @access Private
 */
router.get('/:notificationId/delivery',
  authenticateToken,
  notificationIdValidation,
  validate,
  NotificationController.getDeliveryStatus
);

/**
 * @route GET /api/notifications/test/connectivity
 * @desc Test push notification connectivity
 * @access Private
 */
router.get('/test/connectivity',
  authenticateToken,
  NotificationController.testPushConnectivity
);

export default router;
