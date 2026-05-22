import React from 'react';
import { TasksAnalytics } from '@/components/analytics/TasksAnalytics';

export const AnalyticsTasksPage: React.FC = () => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tasks Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Verification task metrics with status tracking and agent assignment.
          </p>
        </div>
      </div>
      <TasksAnalytics />
    </div>
  );
};

export default AnalyticsTasksPage;
