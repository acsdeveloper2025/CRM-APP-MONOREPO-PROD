import { Case, CaseStatus } from '../types';

/**
 * Case Counter Service
 * Tracks and manages case counts for different statuses with real-time updates
 */

export interface CaseCounts {
  assigned: number;
  inProgress: number;
  completed: number;
  saved: number;
  total: number;
  pendingSync: number;
}

export interface CaseCountUpdate {
  fromStatus?: CaseStatus;
  toStatus: CaseStatus;
  caseId: string;
  timestamp: string;
}

class CaseCounterService {
  private static readonly CASE_COUNTS_KEY = 'caseflow_case_counts';
  private static readonly COUNT_UPDATES_KEY = 'caseflow_count_updates';
  private static listeners: Array<(counts: CaseCounts) => void> = [];

  /**
   * Calculate case counts from case array
   */
  static calculateCounts(cases: Case[]): CaseCounts {
    const counts: CaseCounts = {
      assigned: 0,
      inProgress: 0,
      completed: 0,
      saved: 0,
      total: cases.length,
      pendingSync: 0,
    };

    cases.forEach(caseItem => {
      switch (caseItem.status) {
        case CaseStatus.Assigned:
          counts.assigned++;
          break;
        case CaseStatus.InProgress:
          counts.inProgress++;
          break;
        case CaseStatus.Completed:
          counts.completed++;
          break;
      }

      if (caseItem.isSaved) {
        counts.saved++;
      }

      // Count cases with pending submission status as pending sync
      if (caseItem.submissionStatus === 'pending' || caseItem.submissionStatus === 'failed') {
        counts.pendingSync++;
      }
    });

    return counts;
  }

  /**
   * Update case counts and notify listeners
   */
  static async updateCounts(cases: Case[]): Promise<void> {
    try {
      const newCounts = this.calculateCounts(cases);
      await this.storeCounts(newCounts);
      this.notifyListeners(newCounts);
      
      console.log('📊 Case counts updated:', newCounts);
    } catch (error) {
      console.error('Failed to update case counts:', error);
    }
  }

  /**
   * Get current case counts
   */
  static async getCounts(): Promise<CaseCounts> {
    try {
      const stored = localStorage.getItem(this.CASE_COUNTS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to get case counts:', error);
    }

    // Return default counts if none stored
    return {
      assigned: 0,
      inProgress: 0,
      completed: 0,
      saved: 0,
      total: 0,
      pendingSync: 0,
    };
  }

  /**
   * Store case counts locally
   */
  private static async storeCounts(counts: CaseCounts): Promise<void> {
    try {
      localStorage.setItem(this.CASE_COUNTS_KEY, JSON.stringify(counts));
    } catch (error) {
      console.error('Failed to store case counts:', error);
    }
  }

  /**
   * Record a case status change for count tracking
   */
  static async recordStatusChange(
    caseId: string,
    fromStatus: CaseStatus | undefined,
    toStatus: CaseStatus
  ): Promise<void> {
    try {
      const update: CaseCountUpdate = {
        fromStatus,
        toStatus,
        caseId,
        timestamp: new Date().toISOString(),
      };

      const existingUpdates = await this.getCountUpdates();
      existingUpdates.push(update);

      // Keep only last 100 updates
      if (existingUpdates.length > 100) {
        existingUpdates.splice(0, existingUpdates.length - 100);
      }

      await this.storeCountUpdates(existingUpdates);
      
      console.log(`📈 Recorded status change: ${caseId} ${fromStatus || 'new'} → ${toStatus}`);
    } catch (error) {
      console.error('Failed to record status change:', error);
    }
  }

  /**
   * Get count updates history
   */
  private static async getCountUpdates(): Promise<CaseCountUpdate[]> {
    try {
      const stored = localStorage.getItem(this.COUNT_UPDATES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get count updates:', error);
      return [];
    }
  }

  /**
   * Store count updates history
   */
  private static async storeCountUpdates(updates: CaseCountUpdate[]): Promise<void> {
    try {
      localStorage.setItem(this.COUNT_UPDATES_KEY, JSON.stringify(updates));
    } catch (error) {
      console.error('Failed to store count updates:', error);
    }
  }

  /**
   * Add listener for count changes
   */
  static addCountListener(listener: (counts: CaseCounts) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove count listener
   */
  static removeCountListener(listener: (counts: CaseCounts) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of count changes
   */
  private static notifyListeners(counts: CaseCounts): void {
    this.listeners.forEach(listener => {
      try {
        listener(counts);
      } catch (error) {
        console.error('Error notifying count listener:', error);
      }
    });
  }

  /**
   * Get count summary for UI display
   */
  static async getCountSummary(): Promise<{
    assigned: number;
    inProgress: number;
    completed: number;
    total: number;
    pendingActions: number;
    lastUpdated?: string;
  }> {
    try {
      const counts = await this.getCounts();
      
      return {
        assigned: counts.assigned,
        inProgress: counts.inProgress,
        completed: counts.completed,
        total: counts.total,
        pendingActions: counts.pendingSync + counts.saved,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get count summary:', error);
      return {
        assigned: 0,
        inProgress: 0,
        completed: 0,
        total: 0,
        pendingActions: 0,
      };
    }
  }

  /**
   * Get status distribution as percentages
   */
  static async getStatusDistribution(): Promise<{
    assigned: number;
    inProgress: number;
    completed: number;
  }> {
    try {
      const counts = await this.getCounts();
      
      if (counts.total === 0) {
        return { assigned: 0, inProgress: 0, completed: 0 };
      }

      return {
        assigned: Math.round((counts.assigned / counts.total) * 100),
        inProgress: Math.round((counts.inProgress / counts.total) * 100),
        completed: Math.round((counts.completed / counts.total) * 100),
      };
    } catch (error) {
      console.error('Failed to get status distribution:', error);
      return { assigned: 0, inProgress: 0, completed: 0 };
    }
  }

  /**
   * Clear all count data (for testing or reset)
   */
  static async clearCountData(): Promise<void> {
    try {
      localStorage.removeItem(this.CASE_COUNTS_KEY);
      localStorage.removeItem(this.COUNT_UPDATES_KEY);
      
      // Notify listeners of reset
      const emptyCounts: CaseCounts = {
        assigned: 0,
        inProgress: 0,
        completed: 0,
        saved: 0,
        total: 0,
        pendingSync: 0,
      };
      
      this.notifyListeners(emptyCounts);
      console.log('🗑️ Cleared all case count data');
    } catch (error) {
      console.error('Failed to clear count data:', error);
    }
  }

  /**
   * Get recent status changes for audit/debugging
   */
  static async getRecentStatusChanges(limit: number = 10): Promise<CaseCountUpdate[]> {
    try {
      const updates = await this.getCountUpdates();
      return updates.slice(-limit).reverse(); // Get last N updates, most recent first
    } catch (error) {
      console.error('Failed to get recent status changes:', error);
      return [];
    }
  }
}

export default CaseCounterService;
