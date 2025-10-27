
import React from 'react';
import { CaseStatus } from '../types';
import CaseListScreen from './CaseListScreen';

const SavedCasesScreen: React.FC = () => {
  return (
    <CaseListScreen
      title="Saved for Offline"
      filter={(c) => c.isSaved && (c.taskStatus || c.status) !== CaseStatus.Completed}
      emptyMessage="Use the 'Save' button on a case in the 'In Progress' tab to save it for offline use."
      tabKey="saved"
      searchPlaceholder="Search saved cases..."
    />
  );
};

export default SavedCasesScreen;