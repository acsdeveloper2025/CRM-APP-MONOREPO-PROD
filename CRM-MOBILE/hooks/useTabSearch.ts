import { useState, useMemo, useCallback } from 'react';
import { Case } from '../types';

interface UseTabSearchProps {
  cases: Case[];
  tabKey: string; // Unique identifier for the tab (e.g., 'assigned', 'in-progress', etc.)
}

interface UseTabSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCases: Case[];
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
export const useTabSearch = ({ cases, tabKey }: UseTabSearchProps): UseTabSearchReturn => {
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
  const searchCases = useCallback((cases: Case[], query: string): Case[] => {
    if (!query.trim()) {
      return cases;
    }

    const searchTerm = query.toLowerCase().trim();

    return cases.filter(caseItem => {
      // Search in case UUID
      if (caseItem.id.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in case ID number (the number users see, like #124)
      if (caseItem.caseId && caseItem.caseId.toString().includes(searchTerm)) {
        return true;
      }

      // Search in title
      if (caseItem.title.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in description
      if (caseItem.description.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in customer name
      if (caseItem.customer.name.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in customer contact
      if (caseItem.customer.contact.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in bank name
      if (caseItem.bankName?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in product (handle both string and object types)
      if (caseItem.product) {
        if (typeof caseItem.product === 'string') {
          if (caseItem.product.toLowerCase().includes(searchTerm)) {
            return true;
          }
        } else if (typeof caseItem.product === 'object') {
          // Search in product object properties
          if (caseItem.product.name?.toLowerCase().includes(searchTerm) ||
              caseItem.product.code?.toLowerCase().includes(searchTerm)) {
            return true;
          }
        }
      }

      // Search in trigger
      if (caseItem.trigger?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in visit address
      if (caseItem.visitAddress?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in verification type
      if (caseItem.verificationType.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in verification outcome
      if (caseItem.verificationOutcome?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in system contact number
      if (caseItem.systemContactNumber?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in applicant status
      if (caseItem.applicantStatus?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search in notes
      if (caseItem.notes?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });
  }, []);

  // Memoized filtered cases
  const filteredCases = useMemo(() => {
    return searchCases(cases, searchQuery);
  }, [cases, searchQuery, searchCases]);

  // Result counts
  const resultCount = filteredCases.length;
  const totalCount = cases.length;

  return {
    searchQuery,
    setSearchQuery,
    filteredCases,
    resultCount,
    totalCount,
    clearSearch
  };
};
