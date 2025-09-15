
import React from 'react';
import { CaseStatus } from '../types';
import CaseListScreen from './CaseListScreen';

const CompletedCasesScreen: React.FC = () => {
  return (
    <CaseListScreen
      title="Completed Cases"
      filter={(c) => c.status === CaseStatus.Completed}
      emptyMessage="You have not completed any cases yet."
      tabKey="completed"
      searchPlaceholder="Search completed cases..."
      showTimeline={true}
    />
  );
};

export default CompletedCasesScreen;
