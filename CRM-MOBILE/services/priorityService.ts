/**
 * Priority Service for managing case priorities in local storage
 * This service handles user-defined priorities for In Progress cases only
 */

const PRIORITY_STORAGE_KEY = 'case_priorities';

export interface CasePriority {
  taskId: string;
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
  setPriority(taskId: string, priority: number): void {
    const priorities = this.getPriorities();
    priorities[taskId] = {
      taskId,
      priority,
      updatedAt: new Date().toISOString()
    };
    this.savePriorities(priorities);
  }

  /**
   * Get priority for a specific case
   */
  getPriority(taskId: string): number | null {
    const priorities = this.getPriorities();
    return priorities[taskId]?.priority || null;
  }

  /**
   * Remove priority for a specific case
   */
  removePriority(taskId: string): void {
    const priorities = this.getPriorities();
    delete priorities[taskId];
    this.savePriorities(priorities);
  }

  /**
   * Get all priorities as a map of taskId -> priority
   */
  getAllPriorities(): Record<string, number> {
    const priorities = this.getPriorities();
    const result: Record<string, number> = {};
    
    Object.values(priorities).forEach(({ taskId, priority }) => {
      result[taskId] = priority;
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

    Object.keys(priorities).forEach(taskId => {
      if (!existingSet.has(taskId)) {
        delete priorities[taskId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.savePriorities(priorities);
    }
  }
}

export const priorityService = new PriorityService();
