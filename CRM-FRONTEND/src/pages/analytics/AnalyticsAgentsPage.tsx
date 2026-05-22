import React from 'react';
import { AgentPerformanceCharts } from '@/components/analytics/AgentPerformanceCharts';

export const AnalyticsAgentsPage: React.FC = () => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Agent Performance</h1>
          <p className="text-sm text-muted-foreground">
            Field-agent productivity metrics with trends and per-agent breakdown.
          </p>
        </div>
      </div>
      <AgentPerformanceCharts />
    </div>
  );
};

export default AnalyticsAgentsPage;
