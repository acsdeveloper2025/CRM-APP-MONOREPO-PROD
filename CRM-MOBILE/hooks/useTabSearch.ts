import { useState, useMemo, useCallback } from 'react';
import { VerificationTask } from '../types';

interface UseTabSearchProps {
  tasks: VerificationTask[];
  tabKey: string; // Unique identifier for the tab (e.g., 'assigned', 'in-progress', etc.)
}

interface UseTabSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTasks: VerificationTask[];
  resultCount: number;
  totalCount: number;
  clearSearch: () => void;
}

// Global state to maintain search queries across tabs
const tabSearchQueries: Record<string, string> = {};

/**
 * Custom hook for tab-specific search functionality
 * Maintains search state per tab and provides filtered results
 */
export const useTabSearch = ({ tasks, tabKey }: UseTabSearchProps): UseTabSearchReturn => {
  // Initialize search query from global state or empty string
  const [searchQuery, setSearchQueryState] = useState<string>(
    tabSearchQueries[tabKey] || ''
  );

  // Update both local state and global state when search query changes
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    tabSearchQueries[tabKey] = query;
  }, [tabKey]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  // Search function that checks multiple fields
  const searchTasks = useCallback((tasks: VerificationTask[], query: string): VerificationTask[] => {
    if (!query.trim()) {
      return tasks;
    }

    const searchTerm = query.toLowerCase().trim();

    return tasks.filter(taskItem => {
      // Search in case UUID
      if (taskItem.id.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in case ID number (the number users see, like #124)
      if (taskItem.caseId && taskItem.caseId.toString().includes(searchTerm)) {
        return true;
      }

      // Search in title
      if (taskItem.title.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in description
      if (taskItem.description.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in customer name
      if (taskItem.customer.name.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in customer contact
      if (taskItem.customer.contact.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in bank name
      if (taskItem.bankName?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in product (handle both string and object types)
      if (taskItem.product) {
        if (typeof taskItem.product === 'string') {
          if (taskItem.product.toLowerCase().includes(searchTerm)) {
            return true;
          }
        } else if (typeof taskItem.product === 'object') {
          // Search in product object properties
          if (taskItem.product.name?.toLowerCase().includes(searchTerm) ||
              taskItem.product.code?.toLowerCase().includes(searchTerm)) {
            return true;
          }
        }
      }

      // Search in trigger
      if (taskItem.trigger?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in visit address
      if (taskItem.visitAddress?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in verification type
      if (taskItem.verificationType.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in verification outcome
      if (taskItem.verificationOutcome?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in system contact number
      if (taskItem.systemContactNumber?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in applicant status
      if (taskItem.applicantStatus?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in notes
      if (taskItem.notes?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });
  }, []);

  // Memoized filtered tasks
  const filteredTasks = useMemo(() => {
    return searchTasks(tasks, searchQuery);
  }, [tasks, searchQuery, searchTasks]);

  // Result counts
  const resultCount = filteredTasks.length;
  const totalCount = tasks.length;

  return {
    searchQuery,
    setSearchQuery,
    filteredTasks,
    resultCount,
    totalCount,
    clearSearch
  };
};
