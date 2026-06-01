import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '@/config/database';
import { logger } from '@/config/logger';
import { config } from '@/config';
import { invalidateAuthContextCache, type AuthenticatedRequest } from '@/middleware/auth';
import { EmailDeliveryService } from '@/services/EmailDeliveryService';
import { hasSystemScopeBypass } from '@/security/rbacAccess';
import { createAuditLog } from '@/utils/auditLogger';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const isStrongPassword = (password: string): boolean => STRONG_PASSWORD_REGEX.test(password);

// POST /api/users/:id/generate-temp-password - Generate temporary password
export const generateTemporaryPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');

    // Check if user exists
    const userCheck = await query('SELECT id, name, username, email FROM users WHERE id = $1', [
      id,
    ]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];

    // Generate a temporary password (8 characters: letters + numbers)
    const tempPassword =
      Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();

    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(tempPassword, config.bcryptRounds);

    // Update user's password. F-B3.4: bump tokenVersion to immediately
    // invalidate any in-flight access tokens for this user.
    await query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, id]
    );
    invalidateAuthContextCache(id);

    // Send email with temporary password
    try {
      const emailService = EmailDeliveryService.getInstance();
      const emailResult = await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset - CRM System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Notification</h2>
            <p>Hello ${user.name},</p>
            <p>Your password has been reset by an administrator. Here are your new login credentials:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Username:</strong> ${user.username}</p>
              <p><strong>Temporary Password:</strong> <code style="background-color: #e0e0e0; padding: 2px 4px; border-radius: 3px;">${tempPassword}</code></p>
            </div>
            <p style="color: #d32f2f;"><strong>Important:</strong> Please change this password immediately after logging in for security purposes.</p>
            <p>If you did not request this password reset, please contact your administrator immediately.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">This is an automated message from the CRM System. Please do not reply to this email.</p>
          </div>
        `,
        text: `
Password Reset Notification

Hello ${user.name},

Your password has been reset by an administrator. Here are your new login credentials:

Username: ${user.username}
Temporary Password: ${tempPassword}

Important: Please change this password immediately after logging in for security purposes.

If you did not request this password reset, please contact your administrator immediately.
        `,
      });

      if (emailResult.success) {
        logger.info(`Password reset email sent to ${user.email}`, {
          userId: req.user?.id,
          targetUserId: id,
          messageId: emailResult.messageId,
        });
      } else {
        logger.error(`Failed to send password reset email to ${user.email}`, {
          userId: req.user?.id,
          targetUserId: id,
          error: emailResult.error,
        });
      }
    } catch (emailError) {
      logger.error('Error sending password reset email:', emailError);
    }

    logger.info(`Generated temporary password for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: id,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'GENERATE_TEMP_PASSWORD',
      entityType: 'USER',
      entityId: id,
      details: { targetUsername: user.username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: { temporaryPassword: tempPassword },
      message: 'Temporary password generated and sent via email successfully',
    });
  } catch (error) {
    logger.error('Error generating temporary password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate temporary password',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/:id/change-password - Change user password
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const { currentPassword, newPassword } = req.body;

    // M1: the `user.update` permission gate upstream is necessary but
    // not sufficient here. Without this check, a user with
    // `user.update` who happened to know another user's current
    // password (e.g. a temp password that was emailed to them, a
    // leaked old password) could rotate it and lock the target out.
    // Restrict cross-user changes to system-bypass roles only; every
    // other caller must be changing their own password.
    const callerId = req.user?.id;
    if (id !== callerId && !hasSystemScopeBypass(req.user)) {
      logger.warn('changePassword cross-user attempt denied', {
        callerId,
        targetId: id,
      });
      return res.status(403).json({
        success: false,
        message: 'You can only change your own password',
        error: { code: 'FORBIDDEN' },
      });
    }

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists and get current password
    const userCheck = await query(
      'SELECT id, name, username, password_hash as "password_hash" FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        error: { code: 'INVALID_PASSWORD' },
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, config.bcryptRounds);

    // Update password. F-B3.4: bump tokenVersion to invalidate
    // outstanding access tokens.
    await query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, id]
    );
    invalidateAuthContextCache(id);

    logger.info(`Password changed for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: id,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/users/reset-password - Reset password (admin function)
export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, newPassword } = req.body;

    // Validate input
    if (!username || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username and new password are required',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Check if user exists
    const userCheck = await query(
      'SELECT id, name, username, email FROM users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    const user = userCheck.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);

    // Update password. F-B3.4: bump tokenVersion to invalidate
    // outstanding access tokens.
    await query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, user.id]
    );
    invalidateAuthContextCache(user.id);

    logger.info(`Password reset for user: ${user.username}`, {
      userId: req.user?.id,
      targetUserId: user.id,
    });

    await createAuditLog({
      userId: req.user?.id,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: user.id,
      details: { targetUsername: user.username },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
