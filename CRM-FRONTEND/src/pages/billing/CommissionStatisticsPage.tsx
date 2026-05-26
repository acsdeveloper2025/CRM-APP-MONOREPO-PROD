import React from 'react';
import { CommissionStatsTab } from '@/components/commission/CommissionStatsTab';

export const CommissionStatisticsPage: React.FC = () => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Commission Statistics</h1>
          <p className="text-sm text-muted-foreground">
            Commission breakdown by field executive, client and rate type.
          </p>
        </div>
      </div>
      <CommissionStatsTab />
    </div>
  );
};

export default CommissionStatisticsPage;
