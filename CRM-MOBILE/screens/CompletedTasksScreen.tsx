
import React from 'react';
import { TaskStatus } from '../types';
import TaskListScreen from './TaskListScreen';

const CompletedTasksScreen: React.FC = () => {
  return (
    <TaskListScreen
      title="Completed Cases"
      filter={(c) => (c.taskStatus || c.status) === TaskStatus.Completed}
      emptyMessage="You have not completed any cases yet."
      tabKey="completed"
      searchPlaceholder="Search completed cases..."
      showTimeline={true}
    />
  );
};

export default CompletedTasksScreen;
