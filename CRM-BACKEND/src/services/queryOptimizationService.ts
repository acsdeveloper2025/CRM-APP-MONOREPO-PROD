import type { Pool, QueryResult, QueryResultRow } from 'pg';
import { logger } from '@/config/logger';
import { performance } from 'perf_hooks';
import { errorMessage } from '@/utils/errorMessage';

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
  [key: string]: unknown;
}

export class QueryOptimizationService {
  private pool: Pool;
  private slowQueryThreshold = 100; // 100ms

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Execute optimized query with performance monitoring
   */
  async executeQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
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
          query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
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
        error: errorMessage(error),
        query: text.substring(0, 200),
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
        u.id, u.name, u.username, u.email, u.phone,
        COALESCE(
          (SELECT rv.name FROM user_roles ur JOIN roles_v2 rv ON rv.id = ur.role_id WHERE ur.user_id = u.id ORDER BY rv.name LIMIT 1),
          'UNASSIGNED'
        ) as role,
        u.employee_id, u.is_active, u.last_login, u.created_at, u.updated_at,
        COALESCE(
          (SELECT rv.name FROM user_roles ur JOIN roles_v2 rv ON rv.id = ur.role_id WHERE ur.user_id = u.id ORDER BY rv.name LIMIT 1),
          'UNASSIGNED'
        ) as role_name,
        COALESCE((
          SELECT ARRAY_AGG(DISTINCT p.code ORDER BY p.code)
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.allowed = true
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = u.id
        ), ARRAY[]::text[]) as "role_permissions",
        d.name as "department_name", d.description as "department_description",
        des.name as "designation_name"
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id  
      LEFT JOIN designations des ON u.designation_id = des.id
      WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.username ILIKE $1 OR u.email ILIKE $1)
        AND ($2::boolean IS NULL OR u.is_active = $2)
        AND ($3::text IS NULL OR EXISTS (
          SELECT 1
          FROM user_roles urf
          JOIN roles_v2 rvf ON rvf.id = urf.role_id
          WHERE urf.user_id = u.id AND rvf.name = $3
        ))
      ORDER BY u.name
      LIMIT $4 OFFSET $5
    `;

    return this.executeQuery(
      query,
      [search ? `%${search}%` : null, isActive, role, limit, offset],
      { name: 'get_users_with_relations' }
    );
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
        c.id, c.name, c.code, c.created_at, c.updated_at,
        COUNT(DISTINCT cp.product_id) as "product_count",
        COUNT(DISTINCT cases.case_id) as "case_count",
        COUNT(DISTINCT CASE WHEN cases.status = 'COMPLETED' THEN cases.case_id END) as "completed_cases",
        COUNT(DISTINCT CASE WHEN cases.status = 'PENDING' THEN cases.case_id END) as "pending_cases"
      FROM clients c
      LEFT JOIN client_products cp ON c.id = cp.client_id
      LEFT JOIN cases ON c.id = cases.client_id
      WHERE ($1::text IS NULL OR c.name ILIKE $1 OR c.code ILIKE $1)
      GROUP BY c.id, c.name, c.code, c.created_at, c.updated_at
      ORDER BY c.name
      LIMIT $2 OFFSET $3
    `;

    return this.executeQuery(query, [search ? `%${search}%` : null, limit, offset], {
      name: 'get_clients_with_stats',
    });
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
        c.case_id, c.customer_name, c.customer_phone, c.address,
        c.status, c.priority, c.created_at, c.updated_at,
        cl.name as client_name, cl.code as "client_code",
        u.name as "assigned_to_name", u.employee_id,
        p.name as product_name, p.code as "product_code",
        vt.name as verification_type_name, vt.code as "verification_type_code",
        COUNT(DISTINCT a.id) as "attachment_count",
        COUNT(DISTINCT al.id) as "audit_log_count"
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN verification_types vt ON c.verification_type_id = vt.id
      LEFT JOIN attachments a ON c.id = a.case_id
      LEFT JOIN audit_logs al ON c.case_id::text = al.entity_id AND al.entity_type = 'case'
      WHERE ($1::text IS NULL OR c.status = $1)
        AND ($2::uuid IS NULL OR c.assigned_to = $2)
        AND ($3::integer IS NULL OR c.client_id = $3)
        AND ($4::text IS NULL OR c.customer_name ILIKE $4 OR c.customer_phone ILIKE $4)
      GROUP BY c.case_id, c.customer_name, c.customer_phone, c.address,
               c.status, c.priority, c.created_at, c.updated_at,
               cl.name, cl.code, u.name, u.employee_id, 
               p.name, p.code, vt.name, vt.code
      ORDER BY c.created_at DESC
      LIMIT $5 OFFSET $6
    `;

    return this.executeQuery(
      query,
      [status, assignedTo, clientId, search ? `%${search}%` : null, limit, offset],
      { name: 'get_cases_with_details' }
    );
  }

  /**
   * Get dashboard statistics with optimized queries
   */
  async getDashboardStats(
    userId?: string,
    options: { restrictToAssignedUser?: boolean } = {}
  ): Promise<Record<string, unknown>> {
    const restrictToAssignedUser = Boolean(options.restrictToAssignedUser && userId);
    const baseCondition = restrictToAssignedUser ? 'AND c.assigned_to = $1' : '';
    const params = restrictToAssignedUser ? [userId] : [];

    const query = `
      WITH case_stats AS (
        SELECT 
          COUNT(*) as total_cases,
          COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_cases,
          COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_cases,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_cases,
          COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high_priority_cases,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_cases
        FROM cases c
        WHERE 1=1 ${baseCondition}
      ),
      recent_cases AS (
        SELECT 
          c.case_id, c.customer_name, c.status, c.priority, c.created_at,
          cl.name as client_name, u.name as "assignedToName"
        FROM cases c
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE 1=1 ${baseCondition}
        ORDER BY c.created_at DESC
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(case_stats) FROM case_stats) as stats,
        (SELECT json_agg(recent_cases) FROM recent_cases) as recent_cases
    `;

    const result = await this.executeQuery(query, params, { name: 'get_dashboard_stats' });
    return result.rows[0] as Record<string, unknown>;
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
        u.id as user_id, u.name as user_name, u.username, u.employee_id, u.is_active,
        json_agg(
          DISTINCT jsonb_build_object(
            'pincodeId', p.id,
            'pincodeCode', p.code,
            'cityName', c.name,
            'stateName', s.name,
            'isActive', upa.is_active
          )
        ) FILTER (WHERE p.id IS NOT NULL) as pincodes,
        json_agg(
          DISTINCT jsonb_build_object(
            'areaId', a.id,
            'areaName', a.name,
            'pincodeCode', ap.code,
            'isActive', uaa.is_active
          )
        ) FILTER (WHERE a.id IS NOT NULL) as areas
      FROM users u
      LEFT JOIN user_pincode_assignments upa ON u.id = upa.user_id AND upa.is_active = true
      LEFT JOIN pincodes p ON upa.pincode_id = p.id
      LEFT JOIN cities c ON p.city_id = c.id
      LEFT JOIN states s ON c.state_id = s.id
      LEFT JOIN user_area_assignments uaa ON u.id = uaa.user_id AND uaa.is_active = true
      LEFT JOIN areas a ON uaa.area_id = a.id
      LEFT JOIN pincodes ap ON uaa.pincode_id = ap.id
      WHERE EXISTS (
        SELECT 1
        FROM user_roles urf
        JOIN role_permissions rpf ON rpf.role_id = urf.role_id AND rpf.allowed = true
        JOIN permissions pf ON pf.id = rpf.permission_id
        WHERE urf.user_id = u.id AND pf.code = 'visit.submit'
      )
        AND ($1::text IS NULL OR u.name ILIKE $1 OR u.username ILIKE $1)
        AND ($2::integer IS NULL OR p.id = $2 OR ap.id = $2)
        AND ($3::integer IS NULL OR c.id = $3)
        AND ($4::boolean IS NULL OR u.is_active = $4)
      GROUP BY u.id, u.name, u.username, u.employee_id, u.is_active
      ORDER BY u.name
      LIMIT $5 OFFSET $6
    `;

    return this.executeQuery(
      query,
      [search ? `%${search}%` : null, pincodeId, cityId, isActive, limit, offset],
      { name: 'get_territory_assignments' }
    );
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

      await this.pool.query(
        `
        INSERT INTO query_performance 
        (query_hash, query_text, execution_time, rows_returned, timestamp)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `,
        [queryHash, queryText, executionTime, rowsReturned]
      );
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
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // analyzeQueryPerformance() was REMOVED on 2026-04-10.
  //
  // The old implementation ran `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryText}`
  // where queryText was passed in as a plain string. `EXPLAIN ANALYZE` actually
  // EXECUTES the statement, so passing an INSERT/UPDATE/DELETE would mutate
  // the database. The method had zero callers anywhere in the codebase, so
  // rather than gating it behind a feature flag (which can be flipped on in
  // prod), we deleted it. If query-plan analysis is needed, run it manually
  // via psql or a dedicated admin endpoint that accepts only a whitelisted
  // set of SELECT statements.

  /**
   * Get slow queries report
   */
  async getSlowQueriesReport(hours = 24): Promise<QueryResult> {
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
      name: 'get_slow_queries_report',
    });
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    tableStats: unknown[];
    unusedIndexes: unknown[];
    connectionStats: unknown[];
  }> {
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
      `,
    };

    const results = await Promise.all([
      this.executeQuery(queries.tableStats, [], { name: 'table_stats' }),
      this.executeQuery(queries.indexStats, [], { name: 'index_stats' }),
      this.executeQuery(queries.connectionStats, [], { name: 'connection_stats' }),
    ]);

    return {
      tableStats: results[0].rows,
      unusedIndexes: results[1].rows,
      connectionStats: results[2].rows,
    };
  }
}

export default QueryOptimizationService;
