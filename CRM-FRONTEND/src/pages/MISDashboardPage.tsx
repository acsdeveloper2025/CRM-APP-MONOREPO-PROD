import React from 'react';
import { MISDashboard } from '@/components/reports/MISDashboard';

export const MISDashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MIS Dashboard</h1>
      <MISDashboard />
    </div>
  );
};
