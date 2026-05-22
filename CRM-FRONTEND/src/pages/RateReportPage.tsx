import { RateViewReportTab } from '@/components/rate-management/RateViewReportTab';

export function RateReportPage() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rate Report</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all configured rates with comprehensive filtering and reporting.
        </p>
      </div>
      <RateViewReportTab />
    </div>
  );
}
