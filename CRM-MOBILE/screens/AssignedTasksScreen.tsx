
import React from 'react';
import { TaskStatus } from '../types';
import TaskListScreen from './TaskListScreen';

const AssignedTasksScreen: React.FC = () => {
  return (
    <TaskListScreen
      title="Assigned Cases"
      filter={(c) => (c.taskStatus || c.status) === TaskStatus.Assigned}
      emptyMessage="No assigned cases at the moment."
      tabKey="assigned"
      searchPlaceholder="Search assigned cases..."
    />
  );
};

export default AssignedTasksScreen;
