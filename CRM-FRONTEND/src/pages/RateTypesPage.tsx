import { RateTypesTab } from '@/components/rate-management/RateTypesTab';

export function RateTypesPage() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Rate Types</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage rate types: Local, Local1, Local2, OGL, OGL1, OGL2, Outstation.
        </p>
      </div>
      <RateTypesTab />
    </div>
  );
}
