import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '@/config/logger';
import { performance } from 'perf_hooks';

export interface QueryOptions {
  name?: string;
  timeout?: number;
  logSlowQueries?: boolean;
  slowQueryThreshold?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

export interface FilterOptions {
  search?: string;
  isActive?: boolean;
  role?: string;
  status?: string;
  clientId?: number;
  assignedTo?: string;
  [key: string]: any;
}

export class QueryOptimizationService {
  private pool: Pool;
  private slowQueryThreshold: number = 100; // 100ms

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Execute optimized query with performance monitoring
   */
  async executeQuery<T = any>(
    text: string, 
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();
    const queryName = options.name || 'unnamed_query';
    
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = performance.now() - startTime;
      
      // Log slow queries
      if (duration > (options.slowQueryThreshold || this.slowQueryThreshold)) {
        logger.warn('Slow query detected', {
          queryName,
          duration: `${duration.toFixed(2)}ms`,
          rowCount: result.rowCount,
          query: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        });
        
        // Store query performance data
        await this.storeQueryPerformance(text, duration, result.rowCount || 0);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Query execution failed', {
        queryName,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
        query: text.substring(0, 200)
      });
      throw error;
    }
  }

  /**
   * Get users with optimized joins and filtering
   */
  async getUsersWithRelations(
    filters: FilterOptions = {}, 
    pagination: PaginationOptions
  ): Promise<QueryResult> {
    const { search, isActive, role } = filters;
    const { limit, page } = pagination;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        u.id, u.name, u.username, u.email, u.phone, u.role,
        u."employeeId", u."isActive", u."lastLogin", u."createdAt", u."updatedAt",
        r.name as "roleName", r.permissions as "rolePermissions",
        d.name as "departmentName", d.description as "departmentDescription",
        des.name as "designationName"
      FROM users u
      LEFT JOIN roles r ON u."roleId" = r.id
      LEFT JOIN departments d ON u."departmentId" = d.id  
      LEFT JOIN designations des ON u."designationId" = des.id
      WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.username ILIKE $1 OR u.email ILIKE $1)
        AND ($2::boolean IS NULL OR u."isActive" = $2)
        AND ($3::text IS NULL OR u.role = $3)
      ORDER BY u.name
      LIMIT $4 OFFSET $5
    `;
    
    return this.executeQuery(query, [
      search ? `%${search}%` : null,
      isActive,
      role,
      limit,
      offset
    ], { name: 'get_users_with_relations' });
  }

  /**
   * Get clients with aggregated statistics
   */
  async getClientsWithStats(
    filters: FilterOptions = {}, 
    pagination: PaginationOptions
  ): Promise<QueryResult> {
    const { search } = filters;
    const { limit, page } = pagination;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        c.id, c.name, c.code, c."createdAt", c."updatedAt",
        COUNT(DISTINCT cp."productId") as "productCount",
        COUNT(DISTINCT cases."caseId") as "caseCount",
        COUNT(DISTINCT CASE WHEN cases.status = 'COMPLETED' THEN cases."caseId" END) as "completedCases",
        COUNT(DISTINCT CASE WHEN cases.status = 'PENDING' THEN cases."caseId" END) as "pendingCases"
      FROM clients c
      LEFT JOIN "clientProducts" cp ON c.id = cp."clientId"
      LEFT JOIN cases ON c.id = cases."clientId"
      WHERE ($1::text IS NULL OR c.name ILIKE $1 OR c.code ILIKE $1)
      GROUP BY c.id, c.name, c.code, c."createdAt", c."updatedAt"
      ORDER BY c.name
      LIMIT $2 OFFSET $3
    `;
    
    return this.executeQuery(query, [
      search ? `%${search}%` : null,
      limit,
      offset
    ], { name: 'get_clients_with_stats' });
  }

  /**
   * Get cases with all related data in single query
   */
  async getCasesWithDetails(
    filters: FilterOptions = {}, 
    pagination: PaginationOptions
  ): Promise<QueryResult> {
    const { status, assignedTo, clientId, search } = filters;
    const { limit, page } = pagination;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        c."caseId", c."customerName", c."customerPhone", c.address,
        c.status, c.priority, c."createdAt", c."updatedAt",
        cl.name as "clientName", cl.code as "clientCode",
        u.name as "assignedToName", u."employeeId",
        p.name as "productName", p.code as "productCode",
        vt.name as "verificationTypeName", vt.code as "verificationTypeCode",
        COUNT(DISTINCT a.id) as "attachmentCount",
        COUNT(DISTINCT al.id) as "auditLogCount"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users u ON c."assignedTo" = u.id
      LEFT JOIN products p ON c."productId" = p.id
      LEFT JOIN "verificationTypes" vt ON c."verificationTypeId" = vt.id
      LEFT JOIN attachments a ON c."caseId" = a."caseId"
      LEFT JOIN "auditLogs" al ON c."caseId"::text = al."entityId" AND al."entityType" = 'case'
      WHERE ($1::text IS NULL OR c.status = $1)
        AND ($2::uuid IS NULL OR c."assignedTo" = $2)
        AND ($3::integer IS NULL OR c."clientId" = $3)
        AND ($4::text IS NULL OR c."customerName" ILIKE $4 OR c."customerPhone" ILIKE $4)
      GROUP BY c."caseId", c."customerName", c."customerPhone", c.address,
               c.status, c.priority, c."createdAt", c."updatedAt",
               cl.name, cl.code, u.name, u."employeeId", 
               p.name, p.code, vt.name, vt.code
      ORDER BY c."createdAt" DESC
      LIMIT $5 OFFSET $6
    `;
    
    return this.executeQuery(query, [
      status,
      assignedTo,
      clientId,
      search ? `%${search}%` : null,
      limit,
      offset
    ], { name: 'get_cases_with_details' });
  }

  /**
   * Get dashboard statistics with optimized queries
   */
  async getDashboardStats(userId?: string, role?: string): Promise<any> {
    const baseCondition = role === 'FIELD_AGENT' ? 'AND c."assignedTo" = $1' : '';
    const params = role === 'FIELD_AGENT' ? [userId] : [];

    const query = `
      WITH case_stats AS (
        SELECT 
          COUNT(*) as total_cases,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_cases,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_cases,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_cases,
          COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_cases,
          COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high_priority_cases,
          COUNT(CASE WHEN "createdAt" >= CURRENT_DATE THEN 1 END) as today_cases
        FROM cases c
        WHERE 1=1 ${baseCondition}
      ),
      recent_cases AS (
        SELECT 
          c."caseId", c."customerName", c.status, c.priority, c."createdAt",
          cl.name as "clientName", u.name as "assignedToName"
        FROM cases c
        LEFT JOIN clients cl ON c."clientId" = cl.id
        LEFT JOIN users u ON c."assignedTo" = u.id
        WHERE 1=1 ${baseCondition}
        ORDER BY c."createdAt" DESC
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(case_stats) FROM case_stats) as stats,
        (SELECT json_agg(recent_cases) FROM recent_cases) as recent_cases
    `;

    const result = await this.executeQuery(query, params, { name: 'get_dashboard_stats' });
    return result.rows[0];
  }

  /**
   * Get territory assignments with optimized joins
   */
  async getTerritoryAssignments(
    filters: FilterOptions = {},
    pagination: PaginationOptions
  ): Promise<QueryResult> {
    const { search, pincodeId, cityId, isActive } = filters;
    const { limit, page } = pagination;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        u.id as "userId", u.name as "userName", u.username, u."employeeId", u."isActive",
        json_agg(
          DISTINCT jsonb_build_object(
            'pincodeId', p.id,
            'pincodeCode', p.code,
            'cityName', c.name,
            'stateName', s.name,
            'isActive', upa."isActive"
          )
        ) FILTER (WHERE p.id IS NOT NULL) as pincodes,
        json_agg(
          DISTINCT jsonb_build_object(
            'areaId', a.id,
            'areaName', a.name,
            'pincodeCode', ap.code,
            'isActive', uaa."isActive"
          )
        ) FILTER (WHERE a.id IS NOT NULL) as areas
      FROM users u
      LEFT JOIN "userPincodeAssignments" upa ON u.id = upa."userId" AND upa."isActive" = true
      LEFT JOIN pincodes p ON upa."pincodeId" = p.id
      LEFT JOIN cities c ON p."cityId" = c.id
      LEFT JOIN states s ON c."stateId" = s.id
      LEFT JOIN "userAreaAssignments" uaa ON u.id = uaa."userId" AND uaa."isActive" = true
      LEFT JOIN areas a ON uaa."areaId" = a.id
      LEFT JOIN pincodes ap ON uaa."pincodeId" = ap.id
      WHERE u.role = 'FIELD_AGENT'
        AND ($1::text IS NULL OR u.name ILIKE $1 OR u.username ILIKE $1)
        AND ($2::integer IS NULL OR p.id = $2 OR ap.id = $2)
        AND ($3::integer IS NULL OR c.id = $3)
        AND ($4::boolean IS NULL OR u."isActive" = $4)
      GROUP BY u.id, u.name, u.username, u."employeeId", u."isActive"
      ORDER BY u.name
      LIMIT $5 OFFSET $6
    `;

    return this.executeQuery(query, [
      search ? `%${search}%` : null,
      pincodeId,
      cityId,
      isActive,
      limit,
      offset
    ], { name: 'get_territory_assignments' });
  }

  /**
   * Store query performance data for analysis
   */
  private async storeQueryPerformance(
    queryText: string, 
    executionTime: number, 
    rowsReturned: number
  ): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(queryText);
      
      await this.pool.query(`
        INSERT INTO query_performance 
        (query_hash, query_text, execution_time, rows_returned, timestamp)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [queryHash, queryText, executionTime, rowsReturned]);
    } catch (error) {
      // Don't throw error to avoid breaking main operation
      logger.error('Failed to store query performance data:', error);
    }
  }

  /**
   * Generate hash for query identification
   */
  private generateQueryHash(queryText: string): string {
    // Simple hash function for query identification
    let hash = 0;
    for (let i = 0; i < queryText.length; i++) {
      const char = queryText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Analyze query performance
   */
  async analyzeQueryPerformance(queryText: string): Promise<any> {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryText}`;
    
    try {
      const result = await this.pool.query(explainQuery);
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      return {
        executionTime: plan['Execution Time'],
        planningTime: plan['Planning Time'],
        totalTime: plan['Execution Time'] + plan['Planning Time'],
        plan: plan
      };
    } catch (error) {
      logger.error('Failed to analyze query performance:', error);
      throw error;
    }
  }

  /**
   * Get slow queries report
   */
  async getSlowQueriesReport(hours: number = 24): Promise<QueryResult> {
    const query = `
      SELECT 
        query_hash,
        query_text,
        AVG(execution_time) as avg_execution_time,
        MAX(execution_time) as max_execution_time,
        MIN(execution_time) as min_execution_time,
        COUNT(*) as execution_count,
        MAX(timestamp) as last_execution
      FROM query_performance 
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        AND execution_time > $1
      GROUP BY query_hash, query_text
      ORDER BY avg_execution_time DESC
      LIMIT 20
    `;

    return this.executeQuery(query, [this.slowQueryThreshold], { 
      name: 'get_slow_queries_report' 
    });
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    const queries = {
      tableStats: `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `,
      indexStats: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY tablename, indexname
      `,
      connectionStats: `
        SELECT 
          state,
          COUNT(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
      `
    };

    const results = await Promise.all([
      this.executeQuery(queries.tableStats, [], { name: 'table_stats' }),
      this.executeQuery(queries.indexStats, [], { name: 'index_stats' }),
      this.executeQuery(queries.connectionStats, [], { name: 'connection_stats' })
    ]);

    return {
      tableStats: results[0].rows,
      unusedIndexes: results[1].rows,
      connectionStats: results[2].rows
    };
  }
}

export default QueryOptimizationService;
