import React from 'react';
import { CasesAnalytics } from '@/components/analytics/CasesAnalytics';

export const AnalyticsCasesPage: React.FC = () => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cases Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Case metrics with distribution by client, product, status, and priority.
          </p>
        </div>
      </div>
      <CasesAnalytics />
    </div>
  );
};

export default AnalyticsCasesPage;
