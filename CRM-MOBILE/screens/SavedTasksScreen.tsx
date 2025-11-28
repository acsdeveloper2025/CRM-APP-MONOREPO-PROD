
import React from 'react';
import { TaskStatus } from '../types';
import TaskListScreen from './TaskListScreen';

const SavedTasksScreen: React.FC = () => {
  return (
    <TaskListScreen
      title="Saved for Offline"
      filter={(c) => c.isSaved && (c.taskStatus || c.status) !== TaskStatus.Completed}
      emptyMessage="Use the 'Save' button on a case in the 'In Progress' tab to save it for offline use."
      tabKey="saved"
      searchPlaceholder="Search saved cases..."
    />
  );
};

export default SavedTasksScreen;