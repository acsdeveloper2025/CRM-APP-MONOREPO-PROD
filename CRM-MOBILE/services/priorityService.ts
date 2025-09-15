/**
 * Priority Service for managing case priorities in local storage
 * This service handles user-defined priorities for In Progress cases only
 */

const PRIORITY_STORAGE_KEY = 'case_priorities';

export interface CasePriority {
  caseId: string;
  priority: number;
  updatedAt: string;
}

class PriorityService {
  /**
   * Get all case priorities from local storage
   */
  private getPriorities(): Record<string, CasePriority> {
    try {
      const stored = localStorage.getItem(PRIORITY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error reading priorities from localStorage:', error);
      return {};
    }
  }

  /**
   * Save priorities to local storage
   */
  private savePriorities(priorities: Record<string, CasePriority>): void {
    try {
      localStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(priorities));
    } catch (error) {
      console.error('Error saving priorities to localStorage:', error);
    }
  }

  /**
   * Set priority for a specific case
   */
  setPriority(caseId: string, priority: number): void {
    const priorities = this.getPriorities();
    priorities[caseId] = {
      caseId,
      priority,
      updatedAt: new Date().toISOString()
    };
    this.savePriorities(priorities);
  }

  /**
   * Get priority for a specific case
   */
  getPriority(caseId: string): number | null {
    const priorities = this.getPriorities();
    return priorities[caseId]?.priority || null;
  }

  /**
   * Remove priority for a specific case
   */
  removePriority(caseId: string): void {
    const priorities = this.getPriorities();
    delete priorities[caseId];
    this.savePriorities(priorities);
  }

  /**
   * Get all priorities as a map of caseId -> priority
   */
  getAllPriorities(): Record<string, number> {
    const priorities = this.getPriorities();
    const result: Record<string, number> = {};
    
    Object.values(priorities).forEach(({ caseId, priority }) => {
      result[caseId] = priority;
    });
    
    return result;
  }

  /**
   * Clear all priorities (useful for cleanup)
   */
  clearAllPriorities(): void {
    try {
      localStorage.removeItem(PRIORITY_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing priorities from localStorage:', error);
    }
  }

  /**
   * Clean up priorities for cases that no longer exist
   */
  cleanupPriorities(existingCaseIds: string[]): void {
    const priorities = this.getPriorities();
    const existingSet = new Set(existingCaseIds);
    let hasChanges = false;

    Object.keys(priorities).forEach(caseId => {
      if (!existingSet.has(caseId)) {
        delete priorities[caseId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.savePriorities(priorities);
    }
  }
}

export const priorityService = new PriorityService();
