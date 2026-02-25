import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '@/config/database';
import { config } from '../config';
import type {
  MobileLoginRequest,
  MobileLoginResponse,
  MobileVersionCheckRequest,
  MobileVersionCheckResponse,
  MobileAppConfigResponse,
  MobileNotificationRegistrationRequest,
} from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { logger } from '../utils/logger';
import { AuthenticatedRequest, JwtPayload } from '../types/auth';
import { getPrimaryRoleNameFromRbac, isFieldExecutionActor } from '@/security/rbacAccess';

interface UserQueryResult {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  roleId: number | null;
  employeeId: string;
  designation: string;
  department: string;
  profilePhotoUrl: string | null;
  roleName: string | null;
  permissions: Record<string, unknown>; // Permissions structure can be complex
}

interface UserPincodeRow {
  pincodeId: number;
}

interface UserAreaRow {
  areaId: number;
}

export class MobileAuthController {
  // Mobile login with device registration
  static async mobileLogin(this: void, req: Request, res: Response) {
    try {
      const { username, password }: MobileLoginRequest = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Find user
      const userRes = await query<UserQueryResult>(
        `SELECT u.id, u.name, u.username, u.email, u."passwordHash", u."roleId", u."employeeId", u.designation, u.department, u."profilePhotoUrl"
         FROM users u
         WHERE u.username = $1`,
        [username]
      );
      const user = userRes.rows[0];

      if (!user) {
        await createAuditLog({
          action: 'MOBILE_LOGIN_FAILED',
          entityType: 'USER',
          entityId: username,
          details: { reason: 'User not found' },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: {
            code: 'INVALID_CREDENTIALS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        await createAuditLog({
          action: 'MOBILE_LOGIN_FAILED',
          entityType: 'USER',
          entityId: user.id,
          details: { reason: 'Invalid password' },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: {
            code: 'INVALID_CREDENTIALS',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Simplified authentication - no device validation required
      const rbacRes = await query<{ roles: string[] | null; permissions: string[] | null }>(
        `SELECT
          COALESCE((
            SELECT array_agg(DISTINCT rv2.name)
            FROM user_roles ur
            JOIN roles_v2 rv2 ON rv2.id = ur.role_id
            WHERE ur.user_id = $1
          ), ARRAY[]::varchar[]) as roles,
          COALESCE((
            SELECT array_agg(DISTINCT p.code)
            FROM user_roles ur
            JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
            JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = $1
          ), ARRAY[]::varchar[]) as permissions`,
        [user.id]
      );
      const rbacRoles = rbacRes.rows[0]?.roles || [];
      const rbacPermissionCodes = rbacRes.rows[0]?.permissions || [];
      const derivedRole = getPrimaryRoleNameFromRbac(rbacRoles) || null;
      const authProfile = {
        permissionCodes: rbacPermissionCodes,
      } as unknown as AuthenticatedRequest['user'];

      // Generate tokens (simplified - no device ID)
      // Generate tokens (simplified - no device ID)
      const accessToken = jwt.sign(
        {
          userId: user.id,
        } as JwtPayload,
        config.jwtSecret as jwt.Secret,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        {
          userId: user.id,
          type: 'refresh',
        },
        config.jwtSecret as jwt.Secret,
        { expiresIn: '7d' }
      );

      // Store refresh token (simplified - no device ID)
      await query(
        `INSERT INTO "refreshTokens" (token, "userId", "expiresAt", "createdAt", "ipAddress", "userAgent") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)`,
        [
          refreshToken,
          user.id,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          req.ip,
          req.get('User-Agent') || null,
        ]
      );

      // Fetch role-based assignments for FIELD_AGENT users (mobile app is primarily for field agents)
      let assignedPincodes: number[] = [];
      let assignedAreas: number[] = [];

      if (isFieldExecutionActor(authProfile)) {
        // Fetch assigned pincodes
        const pincodesRes = await query<UserPincodeRow>(
          'SELECT "pincodeId" FROM "userPincodeAssignments" WHERE "userId" = $1 AND "isActive" = true',
          [user.id]
        );
        assignedPincodes = pincodesRes.rows.map(row => row.pincodeId);

        // Fetch assigned areas
        const areasRes = await query<UserAreaRow>(
          'SELECT "areaId" FROM "userAreaAssignments" WHERE "userId" = $1 AND "isActive" = true',
          [user.id]
        );
        assignedAreas = areasRes.rows.map(row => row.areaId);
      }

      await createAuditLog({
        action: 'MOBILE_LOGIN_SUCCESS',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        details: {
          authMethod: 'PASSWORD',
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      const response: MobileLoginResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: derivedRole,
            employeeId: user.employeeId,
            designation: user.designation,
            department: user.department,
            profilePhotoUrl: user.profilePhotoUrl,
            // Include field agent assignments for mobile app
            ...(isFieldExecutionActor(authProfile) && {
              assignedPincodes,
              assignedAreas,
            }),
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 86400, // 24 hours in seconds
          },
        },
      };

      return res.json(response);
    } catch (_error) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Refresh token endpoint
  static async refreshToken(this: void, req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwtSecret as jwt.Secret) as JwtPayload & {
        type?: string;
      };

      // Check if refresh token exists in database
      const storedRes = await query(
        `SELECT rt.token, u.id as "userId", u.username
         FROM "refreshTokens" rt JOIN users u ON u.id = rt."userId"
         WHERE rt.token = $1 AND rt."userId" = $2 AND rt."expiresAt" > CURRENT_TIMESTAMP
         LIMIT 1`,
        [refreshToken, decoded.userId]
      );
      const storedToken = storedRes.rows[0];

      if (!storedToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Generate new access token
      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: storedToken.userId,
        } as JwtPayload,
        config.jwtSecret as jwt.Secret,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
        },
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Mobile logout
  static async mobileLogout(this: void, req: Request, res: Response) {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;

      // Invalidate all refresh tokens for this user
      await query(`DELETE FROM "refreshTokens" WHERE "userId" = $1`, [userId]);

      await createAuditLog({
        action: 'MOBILE_LOGOUT',
        entityType: 'USER',
        entityId: userId,
        userId,
        details: {},
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (_error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'LOGOUT_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Check app version compatibility
  static checkVersion(this: void, req: Request, res: Response) {
    try {
      const { currentVersion, platform, buildNumber } = req.body as MobileVersionCheckRequest;

      const forceUpdate = MobileAuthController.shouldForceUpdate(currentVersion);
      const isVersionSupported = MobileAuthController.isVersionSupported(currentVersion);
      const hasNewerVersion = MobileAuthController.hasNewerVersion(currentVersion);
      const updateRequired = forceUpdate || !isVersionSupported;
      const hasUpdate = hasNewerVersion;

      // Enhanced release information
      const releaseInfo = {
        version: config.mobile.apiVersion,
        releaseDate: '2025-09-01T00:00:00.000Z',
        size: platform === 'IOS' ? '28.5 MB' : '32.1 MB',
        releaseNotes: [
          'Enhanced form submission with photo geo-tagging',
          'Improved offline sync reliability',
          'Better case status real-time updates',
          'Performance optimizations for large datasets',
          'Fixed location accuracy issues',
          'Enhanced security with biometric authentication',
        ].join('\n'),
        features: [
          'Real-time case status synchronization',
          'Enhanced photo gallery with geo-location',
          'Improved search and filtering capabilities',
          'Better offline mode support',
          'Enhanced security features',
        ],
        bugFixes: [
          'Fixed case acceptance not updating status',
          'Resolved CORS issues with API calls',
          'Fixed audit log creation errors',
          'Improved location tracking accuracy',
          'Fixed form validation edge cases',
        ],
        urgent: forceUpdate,
        critical: forceUpdate,
      };

      const response: MobileVersionCheckResponse = {
        success: true,
        updateRequired,
        forceUpdate,
        urgent: forceUpdate,
        latestVersion: config.mobile.apiVersion,
        currentVersion,
        downloadUrl:
          platform === 'IOS'
            ? 'https://apps.apple.com/app/caseflow'
            : 'https://play.google.com/store/apps/details?id=com.caseflow',
        releaseNotes: hasUpdate ? releaseInfo.releaseNotes : '',
        features: hasUpdate ? releaseInfo.features : [],
        bugFixes: hasUpdate ? releaseInfo.bugFixes : [],
        size: hasUpdate ? releaseInfo.size : undefined,
        releaseDate: hasUpdate ? releaseInfo.releaseDate : undefined,
        buildNumber,
        checkTimestamp: new Date().toISOString(),
      };

      // Log version check for analytics
      logger.info(
        `📱 Version check: ${currentVersion} -> ${config.mobile.apiVersion} (${platform})`,
        {
          currentVersion,
          latestVersion: config.mobile.apiVersion,
          platform,
          buildNumber,
          hasNewerVersion: hasUpdate,
          updateRequired,
          forceUpdate,
          isVersionSupported,
        }
      );

      res.json(response);
    } catch (error) {
      console.error('Version check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERSION_CHECK_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get mobile app configuration
  static getAppConfig(this: void, req: Request, res: Response) {
    try {
      const response: MobileAppConfigResponse = {
        apiVersion: config.mobile.apiVersion,
        minSupportedVersion: config.mobile.minSupportedVersion,
        forceUpdateVersion: config.mobile.forceUpdateVersion,
        features: {
          offlineMode: config.mobile.enableOfflineMode,
          backgroundSync: config.mobile.enableBackgroundSync,
          biometricAuth: config.mobile.enableBiometricAuth,
          darkMode: config.mobile.enableDarkMode,
          analytics: config.mobile.enableAnalytics,
        },
        limits: {
          maxFileSize: config.mobile.maxFileSize,
          maxFilesPerCase: config.mobile.maxFilesPerCase,
          locationAccuracyThreshold: config.mobile.locationAccuracyThreshold,
          syncBatchSize: config.mobile.syncBatchSize,
        },
        endpoints: {
          apiBaseUrl: `${req.protocol}://${req.get('host')}/api`,
          wsUrl: `ws://${req.get('host')}:${config.wsPort}`,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('App config error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'CONFIG_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Register device for push notifications (simplified)
  static registerNotifications(this: void, req: Request, res: Response) {
    try {
      const {
        pushToken: _pushToken,
        platform: _platform,
        enabled: _enabled,
        preferences: _preferences,
      } = req.body as MobileNotificationRegistrationRequest;
      const _userId = (req as AuthenticatedRequest).user?.id;

      // Store notification preferences in user profile or separate table
      // For now, just return success since we removed device table
      res.json({
        success: true,
        message: 'Notification registration successful',
      });
    } catch (error) {
      console.error('Notification registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'NOTIFICATION_REGISTRATION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Helper methods
  private static shouldForceUpdate(currentVersion: string): boolean {
    return (
      MobileAuthController.compareVersions(currentVersion, config.mobile.forceUpdateVersion) < 0
    );
  }

  private static isVersionSupported(currentVersion: string): boolean {
    return (
      MobileAuthController.compareVersions(currentVersion, config.mobile.minSupportedVersion) >= 0
    );
  }

  private static hasNewerVersion(currentVersion: string): boolean {
    return MobileAuthController.compareVersions(currentVersion, config.mobile.apiVersion) < 0;
  }

  private static compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part < v2part) {
        return -1;
      }
      if (v1part > v2part) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * Get all devices for a user
   */
  static async getUserDevices(this: void, req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const devs = await query(
        `SELECT * FROM devices WHERE "userId" = $1 ORDER BY "lastActiveAt" DESC`,
        [userId]
      );
      const devices = devs.rows;

      res.json({
        success: true,
        data: devices,
      });
    } catch (error) {
      console.error('Get user devices error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
