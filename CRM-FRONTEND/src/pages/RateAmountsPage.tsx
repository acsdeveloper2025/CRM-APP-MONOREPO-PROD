import { RateAssignmentTab } from '@/components/rate-management/RateAssignmentTab';

export function RateAmountsPage() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rate Amounts</h1>
        <p className="text-sm text-muted-foreground">
          Set actual rate amounts for assigned rate types.
        </p>
      </div>
      <RateAssignmentTab />
    </div>
  );
}
