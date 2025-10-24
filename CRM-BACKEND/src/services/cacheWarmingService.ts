import { EnterpriseCacheService } from './enterpriseCacheService';
import { logger } from '../config/logger';
import { pool } from '../config/database';

/**
 * Cache Warming Service
 * Preloads frequently accessed data into Redis cache on application startup
 * This significantly improves cache hit rates and reduces database load
 */
export class CacheWarmingService {
  /**
   * Warm all critical caches on application startup
   */
  static async warmAllCaches(): Promise<void> {
    logger.info('🔥 Starting cache warming process...');
    const startTime = Date.now();

    try {
      await Promise.allSettled([
        this.warmClientCache(),
        this.warmVerificationTypesCache(),
        this.warmProductsCache(),
        this.warmRateTypesCache(),
        this.warmActiveUsersCache(),
        this.warmRecentCasesCache(),
        this.warmAnalyticsCache(),
      ]);

      const duration = Date.now() - startTime;
      logger.info(`✅ Cache warming completed in ${duration}ms`);
    } catch (error) {
      logger.error('❌ Cache warming failed:', error);
      // Don't throw - application should continue even if cache warming fails
    }
  }

  /**
   * Warm client list cache
   */
  private static async warmClientCache(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT id, name, email, phone, address, "isActive", "createdAt", "updatedAt"
        FROM clients
        WHERE "isActive" = true
        ORDER BY name ASC
      `);

      await EnterpriseCacheService.set('clients:list', result.rows, 3600); // 1 hour
      logger.debug(`✓ Warmed clients cache: ${result.rows.length} clients`);
    } catch (error) {
      logger.error('Failed to warm clients cache:', error);
    }
  }

  /**
   * Warm verification types cache
   */
  private static async warmVerificationTypesCache(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT id, name, description, "isActive", "createdAt", "updatedAt"
        FROM "verificationTypes"
        WHERE "isActive" = true
        ORDER BY name ASC
      `);

      await EnterpriseCacheService.set('verification-types:list', result.rows, 3600); // 1 hour
      logger.debug(`✓ Warmed verification types cache: ${result.rows.length} types`);
    } catch (error) {
      logger.error('Failed to warm verification types cache:', error);
    }
  }

  /**
   * Warm products cache
   */
  private static async warmProductsCache(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT id, name, description, "isActive", "createdAt", "updatedAt"
        FROM products
        WHERE "isActive" = true
        ORDER BY name ASC
      `);

      await EnterpriseCacheService.set('products:list', result.rows, 3600); // 1 hour
      logger.debug(`✓ Warmed products cache: ${result.rows.length} products`);
    } catch (error) {
      logger.error('Failed to warm products cache:', error);
    }
  }

  /**
   * Warm rate types cache
   */
  private static async warmRateTypesCache(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT id, name, description, "isActive", "createdAt", "updatedAt"
        FROM "rateTypes"
        WHERE "isActive" = true
        ORDER BY name ASC
      `);

      await EnterpriseCacheService.set('rate-types:list', result.rows, 3600); // 1 hour
      logger.debug(`✓ Warmed rate types cache: ${result.rows.length} rate types`);
    } catch (error) {
      logger.error('Failed to warm rate types cache:', error);
    }
  }

  /**
   * Warm active users cache
   */
  private static async warmActiveUsersCache(): Promise<void> {
    try {
      // Cache users by role
      const roles = ['FIELD_AGENT', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

      for (const role of roles) {
        const result = await pool.query(`
          SELECT id, username, email, role, name, phone, "isActive"
          FROM users
          WHERE role = $1 AND "isActive" = true
          ORDER BY username ASC
        `, [role]);

        await EnterpriseCacheService.set(`users:list:${role}`, result.rows, 600); // 10 minutes
        logger.debug(`✓ Warmed users cache for ${role}: ${result.rows.length} users`);
      }

      // Cache all active users
      const allResult = await pool.query(`
        SELECT id, username, email, role, name, phone, "isActive"
        FROM users
        WHERE "isActive" = true
        ORDER BY username ASC
      `);

      await EnterpriseCacheService.set('users:list:all', allResult.rows, 600); // 10 minutes
      logger.debug(`✓ Warmed all users cache: ${allResult.rows.length} users`);
    } catch (error) {
      logger.error('Failed to warm users cache:', error);
    }
  }

  /**
   * Warm recent cases cache
   */
  private static async warmRecentCasesCache(): Promise<void> {
    try {
      // Cache recent pending cases (most frequently accessed)
      const pendingResult = await pool.query(`
        SELECT
          c.id, c."caseId", c."customerName", c.status, c.priority,
          c."createdAt", c."updatedAt", c."assignedTo",
          u.username as "assignedToUsername",
          cl.name as "clientName"
        FROM cases c
        LEFT JOIN users u ON c."assignedTo" = u.id
        LEFT JOIN clients cl ON c."clientId" = cl.id
        WHERE c.status = 'PENDING'
        ORDER BY c."createdAt" DESC
        LIMIT 100
      `);

      await EnterpriseCacheService.set('cases:recent:pending', pendingResult.rows, 300); // 5 minutes
      logger.debug(`✓ Warmed recent pending cases cache: ${pendingResult.rows.length} cases`);

      // Cache recent in-progress cases
      const inProgressResult = await pool.query(`
        SELECT
          c.id, c."caseId", c."customerName", c.status, c.priority,
          c."createdAt", c."updatedAt", c."assignedTo",
          u.username as "assignedToUsername",
          cl.name as "clientName"
        FROM cases c
        LEFT JOIN users u ON c."assignedTo" = u.id
        LEFT JOIN clients cl ON c."clientId" = cl.id
        WHERE c.status = 'IN_PROGRESS'
        ORDER BY c."createdAt" DESC
        LIMIT 100
      `);

      await EnterpriseCacheService.set('cases:recent:in-progress', inProgressResult.rows, 300); // 5 minutes
      logger.debug(`✓ Warmed recent in-progress cases cache: ${inProgressResult.rows.length} cases`);
    } catch (error) {
      logger.error('Failed to warm recent cases cache:', error);
    }
  }

  /**
   * Warm analytics cache
   */
  private static async warmAnalyticsCache(): Promise<void> {
    try {
      // Cache case statistics
      const statsResult = await pool.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM cases
        GROUP BY status
      `);

      const stats = statsResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      await EnterpriseCacheService.set('analytics:case-stats', stats, 900); // 15 minutes
      logger.debug(`✓ Warmed case stats cache`);

      // Cache field agent workload
      const workloadResult = await pool.query(`
        SELECT
          u.id,
          u.username,
          u.name,
          COUNT(c.id) as "totalCases",
          COUNT(CASE WHEN c.status = 'PENDING' THEN 1 END) as "pendingCases",
          COUNT(CASE WHEN c.status = 'IN_PROGRESS' THEN 1 END) as "inProgressCases",
          COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END) as "completedCases"
        FROM users u
        LEFT JOIN cases c ON u.id = c."assignedTo"
        WHERE u.role = 'FIELD_AGENT' AND u."isActive" = true
        GROUP BY u.id, u.username, u.name
        ORDER BY "totalCases" DESC
      `);

      await EnterpriseCacheService.set('analytics:field-agent-workload', workloadResult.rows, 600); // 10 minutes
      logger.debug(`✓ Warmed field agent workload cache: ${workloadResult.rows.length} agents`);
    } catch (error) {
      logger.error('Failed to warm analytics cache:', error);
    }
  }

  /**
   * Refresh cache periodically (call this from a scheduled job)
   */
  static async refreshCaches(): Promise<void> {
    logger.info('🔄 Refreshing caches...');
    await this.warmAllCaches();
  }

  /**
   * Invalidate specific cache patterns
   */
  static async invalidateCasesCaches(): Promise<void> {
    try {
      await EnterpriseCacheService.clearByPattern('cases:*');
      await EnterpriseCacheService.clearByPattern('analytics:case-stats');
      await EnterpriseCacheService.clearByPattern('analytics:field-agent-workload');
      logger.debug('✓ Invalidated cases-related caches');
    } catch (error) {
      logger.error('Failed to invalidate cases caches:', error);
    }
  }

  static async invalidateUsersCaches(): Promise<void> {
    try {
      await EnterpriseCacheService.clearByPattern('users:*');
      await EnterpriseCacheService.clearByPattern('analytics:field-agent-workload');
      logger.debug('✓ Invalidated users-related caches');
    } catch (error) {
      logger.error('Failed to invalidate users caches:', error);
    }
  }

  static async invalidateClientsCaches(): Promise<void> {
    try {
      await EnterpriseCacheService.clearByPattern('clients:*');
      logger.debug('✓ Invalidated clients-related caches');
    } catch (error) {
      logger.error('Failed to invalidate clients caches:', error);
    }
  }
}

