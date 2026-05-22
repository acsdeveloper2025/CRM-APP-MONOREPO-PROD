import { RateTypeAssignmentTab } from '@/components/rate-management/RateTypeAssignmentTab';

export function RateTypeAssignmentPage() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rate Type Assignment</h1>
        <p className="text-sm text-muted-foreground">
          Assign rate types to Client → Product → Verification Type combinations.
        </p>
      </div>
      <RateTypeAssignmentTab />
    </div>
  );
}
