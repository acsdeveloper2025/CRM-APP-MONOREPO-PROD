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
        const result = await pool.query(
          `
          SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.name,
            u.phone,
            u."isActive",

            -- Assignment arrays for BACKEND_USER role
            COALESCE(client_arrays.ids, ARRAY[]::int[]) as "assignedClients",
            COALESCE(product_arrays.ids, ARRAY[]::int[]) as "assignedProducts",

            -- Assignment arrays for FIELD_AGENT role
            COALESCE(pincode_arrays.ids, ARRAY[]::int[]) as "assignedPincodes",
            COALESCE(area_arrays.ids, ARRAY[]::int[]) as "assignedAreas"
          FROM users u
          LEFT JOIN (
            SELECT "userId", ARRAY_AGG("clientId") as ids
            FROM "userClientAssignments"
            GROUP BY "userId"
          ) client_arrays ON u.id = client_arrays."userId"
          LEFT JOIN (
            SELECT "userId", ARRAY_AGG("productId") as ids
            FROM "userProductAssignments"
            GROUP BY "userId"
          ) product_arrays ON u.id = product_arrays."userId"
          LEFT JOIN (
            SELECT "userId", ARRAY_AGG("pincodeId") as ids
            FROM "userPincodeAssignments"
            WHERE "isActive" = true
            GROUP BY "userId"
          ) pincode_arrays ON u.id = pincode_arrays."userId"
          LEFT JOIN (
            SELECT "userId", ARRAY_AGG("areaId") as ids
            FROM "userAreaAssignments"
            WHERE "isActive" = true
            GROUP BY "userId"
          ) area_arrays ON u.id = area_arrays."userId"
          WHERE u.role = $1 AND u."isActive" = true
          ORDER BY u.username ASC
        `,
          [role]
        );

        // Store in the same format as the cache middleware expects
        // The cache middleware expects: { data: <API response>, headers, statusCode, timestamp }
        // The API response format is: { success: true, data: [...], pagination: {...} }
        const cacheData = {
          data: {
            success: true,
            data: result.rows,
            pagination: {
              page: 1,
              limit: 20,
              total: result.rows.length,
              totalPages: Math.ceil(result.rows.length / 20),
            },
          },
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            Pragma: 'no-cache',
            Expires: '0',
          },
          statusCode: 200,
          timestamp: Date.now(),
        };
        await EnterpriseCacheService.set(`users:list:${role}`, cacheData, 600); // 10 minutes
        logger.debug(`✓ Warmed users cache for ${role}: ${result.rows.length} users`);
      }

      // Cache all active users
      const allResult = await pool.query(`
        SELECT
          u.id,
          u.username,
          u.email,
          u.role,
          u.name,
          u.phone,
          u."isActive",

          -- Assignment arrays for BACKEND_USER role
          COALESCE(client_arrays.ids, ARRAY[]::int[]) as "assignedClients",
          COALESCE(product_arrays.ids, ARRAY[]::int[]) as "assignedProducts",

          -- Assignment arrays for FIELD_AGENT role
          COALESCE(pincode_arrays.ids, ARRAY[]::int[]) as "assignedPincodes",
          COALESCE(area_arrays.ids, ARRAY[]::int[]) as "assignedAreas"
        FROM users u
        LEFT JOIN (
          SELECT "userId", ARRAY_AGG("clientId") as ids
          FROM "userClientAssignments"
          GROUP BY "userId"
        ) client_arrays ON u.id = client_arrays."userId"
        LEFT JOIN (
          SELECT "userId", ARRAY_AGG("productId") as ids
          FROM "userProductAssignments"
          GROUP BY "userId"
        ) product_arrays ON u.id = product_arrays."userId"
        LEFT JOIN (
          SELECT "userId", ARRAY_AGG("pincodeId") as ids
          FROM "userPincodeAssignments"
          WHERE "isActive" = true
          GROUP BY "userId"
        ) pincode_arrays ON u.id = pincode_arrays."userId"
        LEFT JOIN (
          SELECT "userId", ARRAY_AGG("areaId") as ids
          FROM "userAreaAssignments"
          WHERE "isActive" = true
          GROUP BY "userId"
        ) area_arrays ON u.id = area_arrays."userId"
        WHERE u."isActive" = true
        ORDER BY u.username ASC
      `);

      // Store in the same format as the cache middleware expects
      // The cache middleware expects: { data: <API response>, headers, statusCode, timestamp }
      // The API response format is: { success: true, data: [...], pagination: {...} }
      const allCacheData = {
        data: {
          success: true,
          data: allResult.rows,
          pagination: {
            page: 1,
            limit: 20,
            total: allResult.rows.length,
            totalPages: Math.ceil(allResult.rows.length / 20),
          },
        },
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          Pragma: 'no-cache',
          Expires: '0',
        },
        statusCode: 200,
        timestamp: Date.now(),
      };
      await EnterpriseCacheService.set('users:list:all', allCacheData, 600); // 10 minutes
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
          c."createdAt", c."updatedAt",
          cl.name as "clientName"
        FROM cases c
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
          c."createdAt", c."updatedAt",
          cl.name as "clientName"
        FROM cases c
        LEFT JOIN clients cl ON c."clientId" = cl.id
        WHERE c.status = 'IN_PROGRESS'
        ORDER BY c."createdAt" DESC
        LIMIT 100
      `);

      await EnterpriseCacheService.set('cases:recent:in-progress', inProgressResult.rows, 300); // 5 minutes
      logger.debug(
        `✓ Warmed recent in-progress cases cache: ${inProgressResult.rows.length} cases`
      );
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

      const stats = statsResult.rows.reduce(
        (acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        },
        {} as Record<string, number>
      );

      await EnterpriseCacheService.set('analytics:case-stats', stats, 900); // 15 minutes
      logger.debug(`✓ Warmed case stats cache`);

      // Cache field agent workload (based on task-level assignments)
      const workloadResult = await pool.query(`
        SELECT
          u.id,
          u.username,
          u.name,
          COUNT(DISTINCT vt.case_id) as "totalCases",
          COUNT(DISTINCT CASE WHEN c.status = 'PENDING' THEN vt.case_id END) as "pendingCases",
          COUNT(DISTINCT CASE WHEN c.status = 'IN_PROGRESS' THEN vt.case_id END) as "inProgressCases",
          COUNT(DISTINCT CASE WHEN c.status = 'COMPLETED' THEN vt.case_id END) as "completedCases"
        FROM users u
        LEFT JOIN verification_tasks vt ON u.id = vt.assigned_to
        LEFT JOIN cases c ON vt.case_id = c.id
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
