import { Router } from 'express';
import { pool } from '@/config/database';
import { redisClient } from '@/config/redis';
import { logger } from '@/config/logger';
import { query } from '@/config/database';
import { performance } from 'perf_hooks';

const router = Router();

interface HealthCheckResult {
  status: 'OK' | 'DEGRADED' | 'ERROR';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services?: {
    database: ServiceHealth;
    redis: ServiceHealth;
    memory: ServiceHealth;
    disk: ServiceHealth;
  };
  performance?: {
    avgResponseTime: number;
    errorRate: number;
    requestCount: number;
  };
}

interface ServiceHealth {
  status: 'OK' | 'DEGRADED' | 'ERROR';
  responseTime?: string;
  message?: string;
  details?: any;
}

/**
 * Basic health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  const healthCheck: HealthCheckResult = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(healthCheck);
});

/**
 * Detailed health check with all dependencies
 * GET /api/health/detailed
 */
router.get('/health/detailed', async (req, res) => {
  const startTime = performance.now();
  
  try {
    const [database, redis, memory, disk, performanceMetrics] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkMemory(),
      checkDisk(),
      getPerformanceMetrics()
    ]);

    const services = {
      database: database.status === 'fulfilled' ? database.value : { status: 'ERROR' as const, message: database.reason?.message },
      redis: redis.status === 'fulfilled' ? redis.value : { status: 'ERROR' as const, message: redis.reason?.message },
      memory: memory.status === 'fulfilled' ? memory.value : { status: 'ERROR' as const, message: memory.reason?.message },
      disk: disk.status === 'fulfilled' ? disk.value : { status: 'ERROR' as const, message: disk.reason?.message }
    };

    const performance_data = performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : null;

    // Determine overall status
    const hasErrors = Object.values(services).some(service => service.status === 'ERROR');
    const hasDegraded = Object.values(services).some(service => service.status === 'DEGRADED');
    
    let overallStatus: 'OK' | 'DEGRADED' | 'ERROR' = 'OK';
    if (hasErrors) {
      overallStatus = 'ERROR';
    } else if (hasDegraded) {
      overallStatus = 'DEGRADED';
    }

    const healthCheck: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      performance: performance_data
    };

    const statusCode = overallStatus === 'ERROR' ? 503 : overallStatus === 'DEGRADED' ? 200 : 200;
    
    const totalTime = performance.now() - startTime;
    logger.info('Health check completed', {
      status: overallStatus,
      responseTime: `${totalTime.toFixed(2)}ms`,
      services: Object.fromEntries(
        Object.entries(services).map(([key, value]) => [key, value.status])
      )
    });

    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      error: error.message
    });
  }
});

/**
 * Database health check
 */
async function checkDatabase(): Promise<ServiceHealth> {
  try {
    const startTime = performance.now();
    
    // Test basic connectivity
    await pool.query('SELECT 1');
    
    // Test a more complex query
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = result.rows[0].count;
    
    const responseTime = performance.now() - startTime;
    
    // Get connection pool stats
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };
    
    // Check for potential issues
    let status: 'OK' | 'DEGRADED' = 'OK';
    let message = 'Database is healthy';
    
    if (responseTime > 1000) {
      status = 'DEGRADED';
      message = 'Database response time is slow';
    } else if (pool.waitingCount > 5) {
      status = 'DEGRADED';
      message = 'High database connection wait queue';
    }
    
    return {
      status,
      responseTime: `${responseTime.toFixed(2)}ms`,
      message,
      details: {
        userCount: parseInt(userCount),
        connectionPool: poolStats
      }
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'ERROR',
      message: `Database connection failed: ${error.message}`
    };
  }
}

/**
 * Redis health check
 */
async function checkRedis(): Promise<ServiceHealth> {
  try {
    const startTime = performance.now();
    
    // Test basic connectivity
    await redisClient.ping();
    
    // Test set/get operations
    const testKey = `health_check_${Date.now()}`;
    await redisClient.setEx(testKey, 10, 'test_value');
    const testValue = await redisClient.get(testKey);
    await redisClient.del(testKey);
    
    const responseTime = performance.now() - startTime;
    
    let status: 'OK' | 'DEGRADED' = 'OK';
    let message = 'Redis is healthy';
    
    if (responseTime > 500) {
      status = 'DEGRADED';
      message = 'Redis response time is slow';
    } else if (testValue !== 'test_value') {
      status = 'DEGRADED';
      message = 'Redis set/get operation failed';
    }
    
    return {
      status,
      responseTime: `${responseTime.toFixed(2)}ms`,
      message
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'ERROR',
      message: `Redis connection failed: ${error.message}`
    };
  }
}

/**
 * Memory health check
 */
async function checkMemory(): Promise<ServiceHealth> {
  const usage = process.memoryUsage();
  const totalMB = (usage.rss / 1024 / 1024).toFixed(2);
  const heapUsedMB = (usage.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMB = (usage.heapTotal / 1024 / 1024).toFixed(2);
  const externalMB = (usage.external / 1024 / 1024).toFixed(2);
  
  const heapUtilization = (usage.heapUsed / usage.heapTotal) * 100;
  
  let status: 'OK' | 'DEGRADED' = 'OK';
  let message = 'Memory usage is normal';
  
  if (heapUtilization > 90) {
    status = 'DEGRADED';
    message = 'High heap memory utilization';
  } else if (usage.rss > 1024 * 1024 * 1024) { // 1GB
    status = 'DEGRADED';
    message = 'High RSS memory usage';
  }
  
  return {
    status,
    message,
    details: {
      rss: `${totalMB}MB`,
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      external: `${externalMB}MB`,
      heapUtilization: `${heapUtilization.toFixed(1)}%`
    }
  };
}

/**
 * Disk health check
 */
async function checkDisk(): Promise<ServiceHealth> {
  // Simplified disk check - in production, use proper disk monitoring
  // This would typically check available disk space, I/O metrics, etc.
  
  try {
    // Test file system write capability
    const fs = require('fs').promises;
    const testFile = `/tmp/health_check_${Date.now()}.tmp`;
    
    await fs.writeFile(testFile, 'health check test');
    await fs.unlink(testFile);
    
    return {
      status: 'OK',
      message: 'Disk operations are working'
    };
  } catch (error) {
    return {
      status: 'ERROR',
      message: `Disk operation failed: ${error.message}`
    };
  }
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(): Promise<any> {
  try {
    const result = await query(`
      SELECT 
        AVG(response_time) as avg_response_time,
        COUNT(*) as request_count,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM performance_metrics
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
    `);
    
    const metrics = result.rows[0];
    const errorRate = metrics.request_count > 0 
      ? (metrics.error_count / metrics.request_count) * 100 
      : 0;
    
    return {
      avgResponseTime: parseFloat(metrics.avg_response_time) || 0,
      errorRate: parseFloat(errorRate.toFixed(2)),
      requestCount: parseInt(metrics.request_count) || 0
    };
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    return null;
  }
}

/**
 * Readiness probe - checks if application is ready to serve traffic
 * GET /api/health/ready
 */
router.get('/health/ready', async (req, res) => {
  try {
    // Check critical dependencies
    await pool.query('SELECT 1');
    await redisClient.ping();
    
    res.json({
      status: 'READY',
      timestamp: new Date().toISOString(),
      message: 'Application is ready to serve traffic'
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      message: 'Application is not ready to serve traffic',
      error: error.message
    });
  }
});

/**
 * Liveness probe - checks if application is alive
 * GET /api/health/live
 */
router.get('/health/live', (req, res) => {
  res.json({
    status: 'ALIVE',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    message: 'Application is alive'
  });
});

/**
 * Performance metrics endpoint
 * GET /api/health/metrics
 */
router.get('/health/metrics', async (req, res) => {
  try {
    const timeRange = req.query.range as string || '1h';
    
    const metricsQuery = `
      SELECT 
        DATE_TRUNC('minute', timestamp) as minute,
        AVG(response_time) as avg_response_time,
        MAX(response_time) as max_response_time,
        MIN(response_time) as min_response_time,
        COUNT(*) as request_count,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
        COUNT(CASE WHEN response_time > 1000 THEN 1 END) as slow_request_count
      FROM performance_metrics
      WHERE timestamp > NOW() - INTERVAL '${timeRange}'
      GROUP BY DATE_TRUNC('minute', timestamp)
      ORDER BY minute DESC
      LIMIT 60
    `;
    
    const result = await query(metricsQuery);
    
    res.json({
      success: true,
      data: {
        timeRange,
        metrics: result.rows
      }
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
});

export default router;
