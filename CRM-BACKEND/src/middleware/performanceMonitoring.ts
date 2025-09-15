import { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger';
import { query } from '@/config/database';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface RequestWithMetrics extends Request {
  requestId: string;
  startTime: number;
  metrics?: Partial<PerformanceMetrics>;
}

/**
 * Performance monitoring middleware
 * Tracks request timing, memory usage, and stores metrics
 */
export const performanceMonitoring = (
  req: RequestWithMetrics,
  res: Response,
  next: NextFunction
) => {
  const startTime = performance.now();
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Add request ID and start time to request object
  req.requestId = requestId;
  req.startTime = startTime;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void): any {
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    const metrics: PerformanceMetrics = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      memoryUsage: process.memoryUsage(),
      userId: (req as any).user?.id,
      userAgent: req.get('User-Agent'),
      ipAddress: getClientIP(req),
      timestamp: new Date()
    };

    // Log and store performance metrics
    processPerformanceMetrics(metrics);

    // Call original end method and return its result
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

/**
 * Process and store performance metrics
 */
async function processPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
  const { requestId, method, url, statusCode, responseTime, memoryUsage, userId } = metrics;
  
  // Log performance data
  const logData = {
    requestId,
    method,
    url,
    statusCode,
    responseTime: `${responseTime.toFixed(2)}ms`,
    memoryUsage: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
    }
  };
  
  // Log slow requests (>500ms)
  if (responseTime > 500) {
    logger.warn('Slow request detected', logData);
  } else if (responseTime > 1000) {
    logger.error('Very slow request detected', logData);
  } else {
    logger.debug('Request completed', logData);
  }
  
  // Log error responses
  if (statusCode >= 400) {
    logger.warn('Error response', logData);
  }
  
  // Store metrics in database (async, don't block response)
  setImmediate(() => storePerformanceMetrics(metrics));
}

/**
 * Store performance metrics in database
 */
async function storePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
  try {
    await query(`
      INSERT INTO performance_metrics 
      (request_id, method, url, status_code, response_time, memory_usage, user_id, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      metrics.requestId,
      metrics.method,
      metrics.url,
      metrics.statusCode,
      metrics.responseTime,
      JSON.stringify(metrics.memoryUsage),
      metrics.userId || null,
      metrics.timestamp
    ]);
  } catch (error) {
    logger.error('Failed to store performance metrics:', error);
  }
}

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Memory monitoring middleware
 * Tracks memory usage and alerts on high usage
 */
export const memoryMonitoring = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
  const rssMB = memoryUsage.rss / 1024 / 1024;
  
  // Alert on high memory usage (>80% of heap or >500MB RSS)
  if (heapUsedMB / heapTotalMB > 0.8 || rssMB > 500) {
    logger.warn('High memory usage detected', {
      heapUsed: `${heapUsedMB.toFixed(2)}MB`,
      heapTotal: `${heapTotalMB.toFixed(2)}MB`,
      rss: `${rssMB.toFixed(2)}MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
      heapUtilization: `${((heapUsedMB / heapTotalMB) * 100).toFixed(1)}%`
    });
  }
  
  next();
};

/**
 * Rate limiting with performance tracking
 */
export const performanceAwareRateLimit = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = getClientIP(req);
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < windowStart) {
        requests.delete(ip);
      }
    }
    
    // Get or create client data
    let clientData = requests.get(clientIP);
    if (!clientData || clientData.resetTime < windowStart) {
      clientData = { count: 0, resetTime: now + windowMs };
      requests.set(clientIP, clientData);
    }
    
    // Check rate limit
    if (clientData.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        clientIP,
        requestCount: clientData.count,
        maxRequests,
        windowMs
      });
      
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        }
      });
    }
    
    // Increment request count
    clientData.count++;
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - clientData.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));
    
    next();
  };
};

/**
 * Database connection monitoring
 */
export const databaseMonitoring = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check database connection health
    const startTime = performance.now();
    await query('SELECT 1');
    const dbResponseTime = performance.now() - startTime;
    
    // Log slow database responses
    if (dbResponseTime > 100) {
      logger.warn('Slow database response', {
        responseTime: `${dbResponseTime.toFixed(2)}ms`,
        url: req.originalUrl
      });
    }
    
    // Add database response time to request
    (req as any).dbResponseTime = dbResponseTime;
    
    next();
  } catch (error) {
    logger.error('Database connection check failed', {
      error: error.message,
      url: req.originalUrl
    });
    
    res.status(503).json({
      success: false,
      message: 'Database connection error',
      error: { code: 'DATABASE_UNAVAILABLE' }
    });
  }
};

/**
 * API endpoint performance tracking
 */
export const endpointPerformanceTracking = (endpointName: string) => {
  return (req: RequestWithMetrics, res: Response, next: NextFunction) => {
    const startTime = performance.now();
    
    // Override res.json to track response time
    const originalJson = res.json;
    res.json = function(data: any) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Log endpoint performance
      logger.info('Endpoint performance', {
        endpoint: endpointName,
        method: req.method,
        responseTime: `${responseTime.toFixed(2)}ms`,
        statusCode: res.statusCode,
        requestId: req.requestId
      });
      
      // Store endpoint-specific metrics
      storeEndpointMetrics(endpointName, req.method, responseTime, res.statusCode);
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Store endpoint-specific performance metrics
 */
async function storeEndpointMetrics(
  endpoint: string,
  method: string,
  responseTime: number,
  statusCode: number
): Promise<void> {
  try {
    await query(`
      INSERT INTO system_health_metrics 
      (metric_name, metric_value, metric_unit, tags, timestamp)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [
      'endpoint_response_time',
      responseTime,
      'milliseconds',
      JSON.stringify({ endpoint, method, statusCode })
    ]);
  } catch (error) {
    logger.error('Failed to store endpoint metrics:', error);
  }
}

/**
 * System health monitoring
 */
export const systemHealthMonitoring = () => {
  // Monitor system health every 30 seconds
  setInterval(async () => {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Store system metrics
      await Promise.all([
        query(`
          INSERT INTO system_health_metrics 
          (metric_name, metric_value, metric_unit, timestamp)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, ['memory_heap_used', memoryUsage.heapUsed / 1024 / 1024, 'MB']),
        
        query(`
          INSERT INTO system_health_metrics 
          (metric_name, metric_value, metric_unit, timestamp)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, ['memory_rss', memoryUsage.rss / 1024 / 1024, 'MB']),
        
        query(`
          INSERT INTO system_health_metrics 
          (metric_name, metric_value, metric_unit, timestamp)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, ['cpu_user', cpuUsage.user / 1000, 'milliseconds']),
        
        query(`
          INSERT INTO system_health_metrics 
          (metric_name, metric_value, metric_unit, timestamp)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, ['cpu_system', cpuUsage.system / 1000, 'milliseconds'])
      ]);
      
    } catch (error) {
      logger.error('Failed to store system health metrics:', error);
    }
  }, 30000); // 30 seconds
};

/**
 * Performance metrics aggregation
 */
export const getPerformanceMetrics = async (timeRange: string = '1h') => {
  const query_text = `
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
  
  const result = await query(query_text);
  return result.rows;
};

export default {
  performanceMonitoring,
  memoryMonitoring,
  performanceAwareRateLimit,
  databaseMonitoring,
  endpointPerformanceTracking,
  systemHealthMonitoring,
  getPerformanceMetrics
};
