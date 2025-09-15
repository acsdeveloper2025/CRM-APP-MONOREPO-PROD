
import React, { useState, useMemo } from 'react';
import { CaseStatus, Case } from '../types';
import { useCases } from '../context/CaseContext';
import CaseListScreen from './CaseListScreen';

type SortMode = 'order' | 'priority';

const InProgressCasesScreen: React.FC = () => {
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const { getCasesWithPriorities } = useCases();

  // Create sort function based on current mode
  const sortFunction = useMemo(() => {
    if (sortMode === 'priority') {
      return (a: Case, b: Case) => {
        const casesWithPriorities = getCasesWithPriorities();
        const caseA = casesWithPriorities.find(c => c.id === a.id);
        const caseB = casesWithPriorities.find(c => c.id === b.id);

        const priorityA = caseA?.priority;
        const priorityB = caseB?.priority;

        // Cases with priority come first, sorted by priority number (ascending)
        // Cases without priority come last, sorted by order
        if (priorityA && priorityB) {
          return priorityA - priorityB;
        } else if (priorityA && !priorityB) {
          return -1; // A has priority, B doesn't - A comes first
        } else if (!priorityA && priorityB) {
          return 1; // B has priority, A doesn't - B comes first
        } else {
          // Neither has priority, sort by order
          return (a.order || 0) - (b.order || 0);
        }
      };
    } else {
      // Default order sorting
      return (a: Case, b: Case) => (a.order || 0) - (b.order || 0);
    }
  }, [sortMode, getCasesWithPriorities]);

  return (
    <CaseListScreen
      title="In Progress Cases"
      filter={(c) => c.status === CaseStatus.InProgress && !c.isSaved}
      sort={sortFunction}
      isReorderable={sortMode === 'order'}
      emptyMessage="No cases are currently in progress."
      tabKey="in-progress"
      searchPlaceholder="Search in progress cases..."
      customHeaderActions={
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-400">Sort by:</span>
          <button
            onClick={() => setSortMode('order')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortMode === 'order'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Order
          </button>
          <button
            onClick={() => setSortMode('priority')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortMode === 'priority'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Priority
          </button>
        </div>
      }
    />
  );
};

export default InProgressCasesScreen;