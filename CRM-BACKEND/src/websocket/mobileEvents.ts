import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { query } from '../config/database';

export class MobileWebSocketEvents {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  // Notify mobile app about case assignment
  async notifyCaseAssigned(userId: string, caseData: any) {
    const notificationId = `case_assigned_${caseData.id || caseData.caseId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const notificationData = {
      type: 'CASE_ASSIGNED',
      case: caseData,
      timestamp,
      priority: caseData.priority,
      requiresImmediate: caseData.priority >= 3,
      notificationId,
    };

    // Send WebSocket notification
    this.io.to(`user:${userId}`).emit('mobile:case:assigned', notificationData);

    // Log notification details
    logger.info(`Case assigned notification sent to user ${userId}: ${caseData.id || caseData.caseId}`, {
      notificationId,
      userId,
      caseId: caseData.id || caseData.caseId,
      casePriority: caseData.priority,
      requiresImmediate: caseData.priority >= 3,
      timestamp,
      notificationType: 'CASE_ASSIGNED',
    });

    // Store notification audit log
    try {
      await this.logNotificationAudit({
        notificationId,
        userId,
        caseId: caseData.id || caseData.caseId,
        notificationType: 'CASE_ASSIGNED',
        notificationData: JSON.stringify(notificationData),
        sentAt: timestamp,
        deliveryStatus: 'SENT',
      });
    } catch (error) {
      logger.error('Failed to log case assignment notification audit:', error);
    }
  }

  // Notify mobile app about case status changes
  async notifyCaseStatusChanged(caseId: string, oldStatus: string, newStatus: string, updatedBy: string) {
    const notificationId = `case_status_${caseId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const notificationData = {
      type: 'CASE_STATUS_CHANGED',
      caseId,
      oldStatus,
      newStatus,
      updatedBy,
      timestamp,
      notificationId,
    };

    // Send WebSocket notification
    this.io.to(`case:${caseId}`).emit('mobile:case:status:changed', notificationData);

    // Log notification details
    logger.info(`Case status change notification sent for case ${caseId}: ${oldStatus} -> ${newStatus}`, {
      notificationId,
      caseId,
      oldStatus,
      newStatus,
      updatedBy,
      timestamp,
      notificationType: 'CASE_STATUS_CHANGED',
    });

    // Store notification audit log
    try {
      await this.logNotificationAudit({
        notificationId,
        caseId,
        notificationType: 'CASE_STATUS_CHANGED',
        notificationData: JSON.stringify(notificationData),
        sentAt: timestamp,
        deliveryStatus: 'SENT',
        metadata: JSON.stringify({ oldStatus, newStatus, updatedBy }),
      });
    } catch (error) {
      logger.error('Failed to log case status change notification audit:', error);
    }
  }

  // Notify mobile app about case priority changes
  notifyCasePriorityChanged(caseId: string, oldPriority: number, newPriority: number, updatedBy: string) {
    this.io.to(`case:${caseId}`).emit('mobile:case:priority:changed', {
      type: 'CASE_PRIORITY_CHANGED',
      caseId,
      oldPriority,
      newPriority,
      updatedBy,
      timestamp: new Date().toISOString(),
      requiresImmediate: newPriority >= 3,
    });

    logger.info(`Case priority change notification sent for case ${caseId}: ${oldPriority} -> ${newPriority}`);
  }

  // Notify mobile app about case approval/rejection
  notifyCaseReviewed(caseId: string, outcome: 'APPROVED' | 'REJECTED' | 'REWORK', feedback: string, reviewedBy: string) {
    this.io.to(`case:${caseId}`).emit('mobile:case:reviewed', {
      type: 'CASE_REVIEWED',
      caseId,
      outcome,
      feedback,
      reviewedBy,
      timestamp: new Date().toISOString(),
      requiresAction: outcome === 'REWORK',
    });

    logger.info(`Case review notification sent for case ${caseId}: ${outcome}`);
  }

  // Notify about case assignment to field user
  notifyCaseAssignment(userId: string, caseData: any, assignmentType: 'assignment' | 'reassignment') {
    const notificationId = `case_${assignmentType}_${caseData.id || caseData.caseId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const notificationData = {
      type: assignmentType === 'assignment' ? 'CASE_ASSIGNED' : 'CASE_REASSIGNED',
      id: notificationId,
      title: assignmentType === 'assignment' ? 'New Case Assigned' : 'Case Reassigned',
      message: assignmentType === 'assignment'
        ? `You have been assigned case ${caseData.caseId} for ${caseData.customerName}`
        : `Case ${caseData.caseId} has been reassigned to you`,
      caseId: caseData.id,
      caseNumber: caseData.caseId,
      customerName: caseData.customerName,
      verificationType: caseData.verificationType,
      priority: caseData.priority || 'MEDIUM',
      timestamp,
      actionUrl: `/mobile/cases/${caseData.id}`,
      actionType: 'OPEN_CASE',
      data: {
        assignmentType,
        assignedBy: caseData.assignedBy,
        reason: caseData.reason,
      }
    };

    // Send WebSocket notification to user
    this.io.to(`user:${userId}`).emit('notification', notificationData);

    // Also send to mobile-specific room for backwards compatibility
    this.io.to(`user:${userId}`).emit('mobile:case:assigned', notificationData);

    logger.info(`Case ${assignmentType} notification sent to user ${userId}`, {
      notificationId,
      caseId: caseData.id,
      caseNumber: caseData.caseId,
      assignmentType,
    });
  }

  // Notify about case removal/reassignment to previous field user
  notifyCaseRemoval(userId: string, caseData: any, reason: string) {
    const notificationId = `case_removed_${caseData.id || caseData.caseId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const notificationData = {
      type: 'CASE_REMOVED',
      id: notificationId,
      title: 'Case Removed',
      message: `Case ${caseData.caseId} has been removed from your assignment`,
      caseId: caseData.id,
      caseNumber: caseData.caseId,
      customerName: caseData.customerName,
      timestamp,
      actionUrl: `/mobile/cases`,
      actionType: 'NAVIGATE',
      data: {
        reason: reason,
        removedBy: caseData.removedBy,
      }
    };

    // Send WebSocket notification to user
    this.io.to(`user:${userId}`).emit('notification', notificationData);

    // Also send to mobile-specific room
    this.io.to(`user:${userId}`).emit('mobile:case:removed', notificationData);

    logger.info(`Case removal notification sent to user ${userId}`, {
      notificationId,
      caseId: caseData.id,
      caseNumber: caseData.caseId,
      reason,
    });
  }

  // Notify backend users about case completion
  notifyCaseCompletion(userIds: string[], caseData: any, fieldUserData: any) {
    const notificationId = `case_completed_${caseData.id || caseData.caseId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const notificationData = {
      type: 'CASE_COMPLETED',
      id: notificationId,
      title: 'Case Completed',
      message: `Case ${caseData.caseNumber} has been completed by ${fieldUserData.name}`,
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      customerName: caseData.customerName,
      timestamp,
      actionUrl: `/cases/${caseData.id}`,
      actionType: 'OPEN_CASE',
      data: {
        fieldUserId: fieldUserData.id,
        fieldUserName: fieldUserData.name,
        completionStatus: caseData.completionStatus,
        outcome: caseData.outcome,
      }
    };

    // Send to all notification recipient users
    userIds.forEach(userId => {
      this.io.to(`user:${userId}`).emit('notification', notificationData);
    });

    // Also send to role rooms for case completion notifications
    this.io.to('role:BACKEND_USER').emit('notification', notificationData);
    this.io.to('role:REPORT_PERSON').emit('notification', notificationData);
    this.io.to('role:SUPER_ADMIN').emit('notification', notificationData);

    logger.info(`Case completion notification sent to ${userIds.length} users (BACKEND_USER, REPORT_PERSON, SUPER_ADMIN)`, {
      notificationId,
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      fieldUser: fieldUserData.name,
    });
  }

  // Notify backend users about case revocation
  notifyCaseRevocation(userIds: string[], caseData: any, fieldUserData: any) {
    const notificationId = `case_revoked_${caseData.id || caseData.caseId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const notificationData = {
      type: 'CASE_REVOKED',
      id: notificationId,
      title: 'Case Revoked',
      message: `Case ${caseData.caseNumber} has been revoked by ${fieldUserData.name}`,
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      customerName: caseData.customerName,
      timestamp,
      actionUrl: `/cases/${caseData.id}`,
      actionType: 'OPEN_CASE',
      priority: 'HIGH',
      data: {
        fieldUserId: fieldUserData.id,
        fieldUserName: fieldUserData.name,
        revocationReason: caseData.revocationReason,
      }
    };

    // Send to all backend users
    userIds.forEach(userId => {
      this.io.to(`user:${userId}`).emit('notification', notificationData);
    });

    // Also send to backend role room
    this.io.to('role:BACKEND_USER').emit('notification', notificationData);

    logger.info(`Case revocation notification sent to ${userIds.length} backend users`, {
      notificationId,
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      fieldUser: fieldUserData.name,
      reason: caseData.revocationReason,
    });
  }

  // Notify mobile app about new messages/comments
  notifyNewMessage(caseId: string, message: any, senderId: string) {
    this.io.to(`case:${caseId}`).emit('mobile:case:message:new', {
      type: 'NEW_MESSAGE',
      caseId,
      message,
      senderId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`New message notification sent for case ${caseId} from user ${senderId}`);
  }

  // Notify mobile app about sync completion
  notifySyncCompleted(userId: string, deviceId: string, syncResults: any) {
    this.io.to(`device:${deviceId}`).emit('mobile:sync:completed', {
      type: 'SYNC_COMPLETED',
      results: syncResults,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Sync completion notification sent to device ${deviceId} for user ${userId}`);
  }

  // Notify mobile app about sync conflicts
  notifySyncConflicts(userId: string, deviceId: string, conflicts: any[]) {
    this.io.to(`device:${deviceId}`).emit('mobile:sync:conflicts', {
      type: 'SYNC_CONFLICTS',
      conflicts,
      timestamp: new Date().toISOString(),
      requiresResolution: true,
    });

    logger.info(`Sync conflicts notification sent to device ${deviceId} for user ${userId}: ${conflicts.length} conflicts`);
  }

  // Notify mobile app about app updates
  notifyAppUpdate(platform: 'IOS' | 'ANDROID', updateInfo: any) {
    this.io.to(`platform:${platform}`).emit('mobile:app:update', {
      type: 'APP_UPDATE_AVAILABLE',
      platform,
      updateInfo,
      timestamp: new Date().toISOString(),
      forceUpdate: updateInfo.forceUpdate,
    });

    logger.info(`App update notification sent to ${platform} devices`);
  }

  // Notify mobile app about system maintenance
  notifySystemMaintenance(maintenanceInfo: any) {
    this.io.emit('mobile:system:maintenance', {
      type: 'SYSTEM_MAINTENANCE',
      maintenanceInfo,
      timestamp: new Date().toISOString(),
      affectsOfflineMode: maintenanceInfo.affectsOfflineMode,
    });

    logger.info('System maintenance notification sent to all mobile devices');
  }

  // Notify mobile app about location validation results
  notifyLocationValidation(userId: string, caseId: string, validationResult: any) {
    this.io.to(`user:${userId}`).emit('mobile:location:validation', {
      type: 'LOCATION_VALIDATION',
      caseId,
      validationResult,
      timestamp: new Date().toISOString(),
      requiresAttention: !validationResult.isValid,
    });

    logger.info(`Location validation notification sent to user ${userId} for case ${caseId}`);
  }

  // Notify mobile app about form submission success
  notifyFormSubmitted(userId: string, caseId: string, formType: string, submissionResult: any) {
    this.io.to(`user:${userId}`).emit('mobile:form:submitted', {
      type: 'FORM_SUBMITTED',
      caseId,
      formType,
      submissionResult,
      timestamp: new Date().toISOString(),
      success: submissionResult.success,
    });

    logger.info(`Form submission notification sent to user ${userId} for case ${caseId}: ${formType}`);
  }

  // Notify mobile app about attachment upload progress
  notifyAttachmentProgress(userId: string, caseId: string, progress: any) {
    this.io.to(`user:${userId}`).emit('mobile:attachment:progress', {
      type: 'ATTACHMENT_PROGRESS',
      caseId,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  // Notify mobile app about attachment upload completion
  notifyAttachmentUploaded(userId: string, caseId: string, attachment: any) {
    this.io.to(`user:${userId}`).emit('mobile:attachment:uploaded', {
      type: 'ATTACHMENT_UPLOADED',
      caseId,
      attachment,
      timestamp: new Date().toISOString(),
    });

    // Also notify case watchers
    this.io.to(`case:${caseId}`).emit('mobile:case:attachment:added', {
      type: 'CASE_ATTACHMENT_ADDED',
      caseId,
      attachment,
      uploadedBy: userId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Attachment upload notification sent for case ${caseId}: ${attachment.filename}`);
  }

  // Notify mobile app about network connectivity issues
  notifyConnectivityIssue(userId: string, deviceId: string, issueType: string) {
    this.io.to(`device:${deviceId}`).emit('mobile:connectivity:issue', {
      type: 'CONNECTIVITY_ISSUE',
      issueType,
      timestamp: new Date().toISOString(),
      recommendations: this.getConnectivityRecommendations(issueType),
    });

    logger.info(`Connectivity issue notification sent to device ${deviceId}: ${issueType}`);
  }

  // Notify mobile app about background sync triggers
  notifyBackgroundSync(userId: string, deviceId: string, reason: string) {
    this.io.to(`device:${deviceId}`).emit('mobile:sync:trigger', {
      type: 'SYNC_TRIGGER',
      reason,
      timestamp: new Date().toISOString(),
      priority: 'background',
    });

    logger.info(`Background sync trigger sent to device ${deviceId}: ${reason}`);
  }

  // Notify mobile app about emergency alerts
  notifyEmergencyAlert(alertData: any) {
    this.io.emit('mobile:alert:emergency', {
      type: 'EMERGENCY_ALERT',
      alert: alertData,
      timestamp: new Date().toISOString(),
      priority: 'high',
      requiresAcknowledgment: true,
    });

    logger.warn(`Emergency alert sent to all mobile devices: ${alertData.message}`);
  }

  // Helper method to get connectivity recommendations
  private getConnectivityRecommendations(issueType: string): string[] {
    switch (issueType) {
      case 'SLOW_CONNECTION':
        return [
          'Switch to Wi-Fi if available',
          'Move to an area with better signal',
          'Enable offline mode for better performance',
        ];
      case 'INTERMITTENT_CONNECTION':
        return [
          'Enable background sync',
          'Save work frequently',
          'Check network settings',
        ];
      case 'NO_CONNECTION':
        return [
          'Work in offline mode',
          'Data will sync when connection is restored',
          'Check airplane mode and network settings',
        ];
      default:
        return ['Check your network connection'];
    }
  }

  // Broadcast to all mobile users of a specific role
  broadcastToRole(role: string, event: string, data: any) {
    this.io.to(`role:${role}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Broadcast sent to role ${role}: ${event}`);
  }

  // Broadcast to all mobile users
  broadcastToAllMobile(event: string, data: any) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Broadcast sent to all mobile devices: ${event}`);
  }

  /**
   * Log notification audit for tracking and compliance
   */
  private async logNotificationAudit(auditData: {
    notificationId: string;
    userId?: string;
    caseId?: string;
    notificationType: string;
    notificationData: string;
    sentAt: string;
    deliveryStatus: 'SENT' | 'DELIVERED' | 'FAILED' | 'ACKNOWLEDGED';
    metadata?: string;
  }): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO mobile_notification_audit (
          "notificationId", "userId", "caseId", "notificationType",
          "notificationData", "sentAt", "deliveryStatus", "metadata"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      await query(insertQuery, [
        auditData.notificationId,
        auditData.userId || null,
        auditData.caseId || null,
        auditData.notificationType,
        auditData.notificationData,
        auditData.sentAt,
        auditData.deliveryStatus,
        auditData.metadata || null,
      ]);

      logger.debug(`Notification audit logged: ${auditData.notificationId}`);
    } catch (error) {
      logger.error('Failed to log notification audit:', error);
      // Don't throw error to avoid breaking notification flow
    }
  }

  /**
   * Update notification delivery status (called when mobile app acknowledges)
   */
  async updateNotificationStatus(notificationId: string, status: 'DELIVERED' | 'ACKNOWLEDGED' | 'FAILED'): Promise<void> {
    try {
      const updateQuery = `
        UPDATE mobile_notification_audit
        SET "deliveryStatus" = $1, "acknowledgedAt" = CURRENT_TIMESTAMP
        WHERE "notificationId" = $2
      `;

      await query(updateQuery, [status, notificationId]);

      logger.debug(`Notification status updated: ${notificationId} -> ${status}`);
    } catch (error) {
      logger.error('Failed to update notification status:', error);
    }
  }
}
