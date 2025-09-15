import { Pool } from 'pg';
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
}

export interface DeduplicationResult {
  duplicatesFound: DuplicateCase[];
  searchCriteria: DeduplicationCriteria;
  totalMatches: number;
}

export interface DeduplicationDecision {
  caseId: string;
  decision: 'CREATE_NEW' | 'USE_EXISTING' | 'MERGE_CASES';
  rationale: string;
  selectedExistingCaseId?: string;
}

export class DeduplicationService {
  constructor(private db: Pool) {}

  /**
   * Search for potential duplicate cases based on provided criteria
   */
  async searchDuplicates(criteria: DeduplicationCriteria): Promise<DeduplicationResult> {
    try {
      logger.info('Starting deduplication search', { criteria });

      const searchConditions: string[] = [];
      const searchParams: any[] = [];
      let paramIndex = 1;

      // Exact matches for structured data
      if (criteria.panNumber) {
        searchConditions.push(`"panNumber" = $${paramIndex}`);
        searchParams.push(criteria.panNumber.toUpperCase());
        paramIndex++;
      }

      if (criteria.customerPhone) {
        searchConditions.push(`"customerPhone" = $${paramIndex}`);
        searchParams.push(criteria.customerPhone);
        paramIndex++;
      }

      // Fuzzy matching for names
      if (criteria.customerName) {
        searchConditions.push(`
          (similarity("customerName", $${paramIndex}) > 0.6
           OR "customerName" ILIKE '%' || $${paramIndex} || '%'
           OR $${paramIndex} ILIKE '%' || "customerName" || '%')
        `);
        searchParams.push(criteria.customerName);
        paramIndex++;
      }

      if (searchConditions.length === 0) {
        return {
          duplicatesFound: [],
          searchCriteria: criteria,
          totalMatches: 0
        };
      }

      const query = `
        SELECT
          c."caseId",
          c."customerName",
          c."customerPhone",
          c."panNumber",
          c.status,
          c."createdAt",
          cl.name as "clientName"
        FROM cases c
        LEFT JOIN clients cl ON c."clientId" = cl.id
        WHERE (${searchConditions.join(' OR ')})
        ORDER BY c."createdAt" DESC
        LIMIT 50
      `;

      const result = await this.db.query(query, searchParams);
      
      const duplicatesFound: DuplicateCase[] = result.rows.map(row => {
        const matchTypes: string[] = [];
        let matchScore = 0;

        // Calculate match types and score
        if (criteria.panNumber && row.panNumber === criteria.panNumber?.toUpperCase()) {
          matchTypes.push('PAN');
          matchScore += 100;
        }
        if (criteria.customerPhone && row.customerPhone === criteria.customerPhone) {
          matchTypes.push('Phone');
          matchScore += 80;
        }
        if (criteria.customerName) {
          // Simple name similarity check
          const nameMatch = this.calculateNameSimilarity(criteria.customerName, row.customerName);
          if (nameMatch > 0.6) {
            matchTypes.push('Name');
            matchScore += Math.floor(nameMatch * 60);
          }
        }

        return {
          id: row.caseId.toString(),
          caseId: row.caseId,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          panNumber: row.panNumber,
          status: row.status,
          createdAt: row.createdAt,
          clientName: row.clientName,
          matchType: matchTypes,
          matchScore
        };
      });

      // Sort by match score (highest first)
      duplicatesFound.sort((a, b) => b.matchScore - a.matchScore);

      logger.info('Deduplication search completed', { 
        totalMatches: duplicatesFound.length,
        criteria 
      });

      return {
        duplicatesFound,
        searchCriteria: criteria,
        totalMatches: duplicatesFound.length
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
      const query = `
        INSERT INTO "caseDeduplicationAudit" (
          "caseId",
          "searchCriteria",
          "duplicatesFound",
          "userDecision",
          "rationale",
          "performedBy"
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      await this.db.query(query, [
        decision.caseId,
        JSON.stringify(searchCriteria),
        JSON.stringify(duplicatesFound),
        decision.decision,
        decision.rationale,
        performedBy
      ]);

      // Update the case with deduplication info
      const updateCaseQuery = `
        UPDATE cases 
        SET 
          "deduplicationChecked" = true,
          "deduplicationDecision" = $1,
          "deduplicationRationale" = $2,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $3
      `;

      await this.db.query(updateCaseQuery, [
        decision.decision,
        decision.rationale,
        decision.caseId
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
  async getDeduplicationHistory(caseId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          cda.*,
          u.name as "performedByName"
        FROM "caseDeduplicationAudit" cda
        LEFT JOIN users u ON cda."performedBy" = u.id
        WHERE cda."caseId" = $1
        ORDER BY cda."performedAt" DESC
      `;

      const result = await this.db.query(query, [caseId]);
      return result.rows;

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

    if (n1 === n2) return 1.0;

    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(n1.length, n2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(n1, n2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

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
