
import React from 'react';
import { CaseStatus } from '../types';
import CaseListScreen from './CaseListScreen';

const AssignedCasesScreen: React.FC = () => {
  return (
    <CaseListScreen
      title="Assigned Cases"
      filter={(c) => c.status === CaseStatus.Assigned}
      emptyMessage="No assigned cases at the moment."
      tabKey="assigned"
      searchPlaceholder="Search assigned cases..."
    />
  );
};

export default AssignedCasesScreen;
