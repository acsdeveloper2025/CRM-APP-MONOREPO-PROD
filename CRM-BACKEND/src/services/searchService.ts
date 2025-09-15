import { Pool } from 'pg';

export interface SearchFilters {
  status?: string;
  clientId?: number;
  assignedTo?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  priority?: string;
  verificationType?: string | string[];
  verificationDate?: {
    from?: string;
    to?: string;
    start?: Date;
    end?: Date;
  };
  createdDate?: {
    from?: string;
    to?: string;
    start?: Date;
    end?: Date;
  };
  propertyValueRange?: {
    min: number;
    max: number;
  };
  businessTurnoverRange?: {
    min: number;
    max: number;
  };
  searchTerm?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerPan?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressLocatable?: boolean;
  verifierName?: string;
  finalStatus?: string[];
  recommendationStatus?: string[];
  riskCategory?: string[];
  propertyType?: string[];
  businessName?: string;
  businessType?: string[];
  gstNumber?: string;
}

export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  includeRawData?: boolean;
}

export interface SearchResult {
  cases: any[];
  total: number;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

class SearchService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async searchCases(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Add search query condition
    if (query && query.trim()) {
      conditions.push(`(
        c."customerName" ILIKE $${paramIndex} OR
        c."customerPhone" ILIKE $${paramIndex} OR
        c.address ILIKE $${paramIndex} OR
        c."caseId"::text ILIKE $${paramIndex}
      )`);
      params.push(`%${query.trim()}%`);
      paramIndex++;
    }

    // Add filters
    if (filters.status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.clientId) {
      conditions.push(`c."clientId" = $${paramIndex}`);
      params.push(filters.clientId);
      paramIndex++;
    }

    if (filters.assignedTo) {
      conditions.push(`c."assignedTo" = $${paramIndex}`);
      params.push(filters.assignedTo);
      paramIndex++;
    }

    if (filters.priority) {
      conditions.push(`c.priority = $${paramIndex}`);
      params.push(filters.priority);
      paramIndex++;
    }

    if (filters.dateRange) {
      conditions.push(`c."createdAt" BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cases c
      ${whereClause}
    `;

    // Main query
    const searchQuery = `
      SELECT 
        c.*,
        cl.name as "clientName",
        u.name as "assignedToName"
      FROM cases c
      LEFT JOIN clients cl ON c."clientId" = cl.id
      LEFT JOIN users u ON c."assignedTo" = u.id
      ${whereClause}
      ORDER BY c."${sortBy}" ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const [countResult, casesResult] = await Promise.all([
      this.pool.query(countQuery, params),
      this.pool.query(searchQuery, [...params, limit, offset])
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return {
      cases: casesResult.rows,
      total,
      totalCount: total,
      page,
      limit,
      totalPages
    };
  }

  async getSearchSuggestions(field: string, query: string, limit: number = 10): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Map field names to database columns
    const fieldMapping: { [key: string]: string } = {
      'customerName': '"customerName"',
      'customerPhone': '"customerPhone"',
      'address': 'address',
      'city': 'address', // Extract city from address
      'state': 'address' // Extract state from address
    };

    const dbField = fieldMapping[field] || '"customerName"';

    const searchQuery = `
      SELECT DISTINCT ${dbField} as suggestion
      FROM cases
      WHERE ${dbField} ILIKE $1
      LIMIT $2
    `;

    const result = await this.pool.query(searchQuery, [`%${query.trim()}%`, limit]);
    return result.rows.map((row: any) => row.suggestion);
  }

  async searchFormSubmissions(
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    // Delegate to searchCases for now - can be specialized later
    return this.searchCases('', filters, options);
  }

  async findSimilarCases(
    caseId: string,
    similarityType: string = 'customer',
    limit: number = 10
  ): Promise<any[]> {
    const query = `
      SELECT c.*,
        similarity(c."customerName", ref."customerName") as name_similarity,
        similarity(c.address, ref.address) as address_similarity
      FROM cases c
      CROSS JOIN (SELECT "customerName", address FROM cases WHERE id = $1) ref
      WHERE c.id != $1
      ORDER BY
        CASE
          WHEN $2 = 'customer' THEN similarity(c."customerName", ref."customerName")
          WHEN $2 = 'address' THEN similarity(c.address, ref.address)
          ELSE 0.5
        END DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [caseId, similarityType, limit]);
    return result.rows;
  }
}

export default SearchService;
