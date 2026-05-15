import type { Pool } from 'pg';
import { logger } from '@/utils/logger';

export interface DeduplicationCriteria {
  customerName?: string;
  panNumber?: string;
  customerPhone?: string;
}

export interface DuplicateCase {
  id: string;
  caseId: number;
  customerName: string;
  customerPhone?: string;
  panNumber?: string;
  status: string;
  createdAt: string;
  clientName?: string;
  matchType: string[];
  matchScore: number;
  // Enhanced fields for better duplicate identification
  productName?: string;
  verificationTypeName?: string;
  pincode?: string;
  verificationOutcome?: string;
}

export interface DeduplicationResult {
  duplicatesFound: DuplicateCase[];
  searchCriteria: DeduplicationCriteria;
  totalMatches: number;
}

export interface DeduplicationDecision {
  caseId: string;
  decision: 'CREATE_NEW' | 'USE_EXISTING' | 'MERGE_CASES' | 'NO_DUPLICATES_FOUND';
  rationale: string;
  selectedExistingCaseId?: string;
}

export class DeduplicationService {
  constructor(private db: Pool) {}

  /**
   * Search for potential duplicate cases based on provided criteria
   */
  async searchDuplicates(criteria: DeduplicationCriteria): Promise<DeduplicationResult> {
    const start = Date.now();
    try {
      // P25 (2026-05-15): strict exact-equality on PAN / phone / name.
      // Old behaviour used `customer_name ILIKE '%X%' OR 'X' ILIKE
      // '%customer_name%'` which matched any substring overlap (entering
      // "A" returned every case whose name contained the letter A) and
      // pushed those score-0 rows back to the FE, opening the dedupe
      // dialog on every case-creation regardless of real matches.
      // The contract is now: a row is a duplicate only when ONE of PAN /
      // phone / name is an EXACT match. Returned rows always have
      // matchScore = 100 and at least one entry in matchType.
      //
      // Inputs are normalised in JS so the SQL can hit B-tree indexes
      // (idx_cases_pan_number, idx_cases_customer_phone,
      // idx_cases_customer_name_btree). Customer names are stored
      // UPPERCASE by project convention (verified 94/94 on prod), so
      // a plain `customer_name = $X` after upper-trimming the input is
      // sufficient — no functional index needed.

      const normalizedPan = criteria.panNumber?.trim().toUpperCase() || null;
      const normalizedPhone = criteria.customerPhone?.trim() || null;
      const normalizedName = criteria.customerName?.trim().toUpperCase() || null;

      logger.info('Starting deduplication search', {
        criteria,
        normalizedPan,
        normalizedPhone,
        normalizedName,
      });

      const searchConditions: string[] = [];
      const searchParams: (string | number)[] = [];
      let paramIndex = 1;

      if (normalizedPan) {
        searchConditions.push(`c.pan_number = $${paramIndex}`);
        searchParams.push(normalizedPan);
        paramIndex++;
      }
      if (normalizedPhone) {
        searchConditions.push(`c.customer_phone = $${paramIndex}`);
        searchParams.push(normalizedPhone);
        paramIndex++;
      }
      if (normalizedName) {
        searchConditions.push(`c.customer_name = $${paramIndex}`);
        searchParams.push(normalizedName);
        paramIndex++;
      }

      if (searchConditions.length === 0) {
        return {
          duplicatesFound: [],
          searchCriteria: criteria,
          totalMatches: 0,
        };
      }

      const query = `
        SELECT
          c.id,
          c.case_id,
          c.case_id as case_number,
          c.customer_name,
          c.customer_phone,
          c.pan_number,
          c.status,
          c.created_at,
          c.verification_outcome,
          -- F5.1.x: cases.pincode dropped; derive from first task
          (SELECT p2.code FROM verification_tasks vt2 JOIN pincodes p2 ON p2.id = vt2.pincode_id WHERE vt2.case_id = c.id AND vt2.pincode_id IS NOT NULL LIMIT 1) AS pincode,
          cl.name as client_name,
          p.name as product_name,
          vt.name as verification_type_name
        FROM cases c
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN products p ON c.product_id = p.id
        LEFT JOIN verification_types vt ON c.verification_type_id = vt.id
        WHERE (${searchConditions.join(' OR ')})
        ORDER BY c.created_at DESC
        LIMIT 200
      `;

      const result = await this.db.query(query, searchParams);

      const duplicatesFound: DuplicateCase[] = result.rows.map(row => {
        // Every returned row is guaranteed to be an exact match on at
        // least one of the three criteria (per the WHERE clause above).
        // Build matchType from whichever field actually matched.
        const matchTypes: string[] = [];
        if (normalizedPan && row.pan_number === normalizedPan) {
          matchTypes.push('PAN');
        }
        if (normalizedPhone && row.customer_phone === normalizedPhone) {
          matchTypes.push('Phone');
        }
        if (normalizedName && row.customer_name === normalizedName) {
          matchTypes.push('Name');
        }

        return {
          id: row.id || row.case_id.toString(),
          caseId: row.case_id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          panNumber: row.pan_number,
          status: row.status,
          createdAt: row.created_at,
          clientName: row.client_name,
          productName: row.product_name,
          verificationTypeName: row.verification_type_name,
          pincode: row.pincode,
          verificationOutcome: row.verification_outcome,
          matchType: matchTypes,
          matchScore: 100,
        };
      });

      logger.info('Deduplication search completed', {
        totalMatches: duplicatesFound.length,
        latencyMs: Date.now() - start,
        criteria,
      });

      return {
        duplicatesFound,
        searchCriteria: criteria,
        totalMatches: duplicatesFound.length,
      };
    } catch (error) {
      logger.error('Error in deduplication search', { error, criteria });
      throw new Error('Failed to perform deduplication search');
    }
  }

  /**
   * Record deduplication decision for audit purposes
   */
  async recordDeduplicationDecision(
    decision: DeduplicationDecision,
    duplicatesFound: DuplicateCase[],
    searchCriteria: DeduplicationCriteria,
    performedBy: string
  ): Promise<void> {
    try {
      // Skip recording if this is a CREATE_NEW decision with placeholder caseId
      // The decision will be recorded when the actual case is created
      if (decision.decision === 'CREATE_NEW' && decision.caseId === 'NEW_CASE_PLACEHOLDER') {
        logger.info('Skipping deduplication audit for CREATE_NEW with placeholder case_id', {
          decision,
          performedBy,
        });
        return;
      }

      const query = `
        INSERT INTO case_deduplication_audit (
          case_id,
          search_criteria,
          duplicates_found,
          user_decision,
          "rationale",
          performed_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      await this.db.query(query, [
        decision.caseId,
        JSON.stringify(searchCriteria),
        JSON.stringify(duplicatesFound),
        decision.decision,
        decision.rationale,
        performedBy,
      ]);

      // Update the case with deduplication info
      const updateCaseQuery = `
        UPDATE cases
        SET
          deduplication_checked = true,
          deduplication_decision = $1,
          deduplication_rationale = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;

      await this.db.query(updateCaseQuery, [
        decision.decision,
        decision.rationale,
        decision.caseId,
      ]);

      logger.info('Deduplication decision recorded', { decision, performedBy });
    } catch (error) {
      logger.error('Error recording deduplication decision', { error, decision });
      throw new Error('Failed to record deduplication decision');
    }
  }

  /**
   * Get deduplication audit history for a case
   */
  async getDeduplicationHistory(caseId: string): Promise<unknown[]> {
    try {
      const query = `
        SELECT 
          cda.*,
          u.name as "performed_by_name"
        FROM case_deduplication_audit cda
        LEFT JOIN users u ON cda.performed_by = u.id
        WHERE cda.case_id = $1
        ORDER BY cda.performed_at DESC
      `;

      const result = await this.db.query(query, [caseId]);
      return result.rows as unknown as {
        caseId: string;
        matchType: string;
        matchDetails: Record<string, unknown>;
        timestamp: Date;
      }[];
    } catch (error) {
      logger.error('Error fetching deduplication history', { error, caseId });
      throw new Error('Failed to fetch deduplication history');
    }
  }

  /**
   * Simple name similarity calculation
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) {
      return 1.0;
    }

    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(n1.length, n2.length);
    if (maxLength === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(n1, n2);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
