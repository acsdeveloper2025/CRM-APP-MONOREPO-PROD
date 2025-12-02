import React from 'react';
import TaskListScreen from './TaskListScreen';
import { VerificationTask } from '../types';

const RevokedTasksScreen: React.FC = () => {
  return (
    <TaskListScreen
      filter={(task: VerificationTask) => task.isRevoked === true}
      title="Revoked Tasks"
      emptyMessage="No revoked tasks. Tasks you've revoked will appear here."
      tabKey="revoked"
      searchPlaceholder="Search revoked tasks..."
    />
  );
};

export default RevokedTasksScreen;
