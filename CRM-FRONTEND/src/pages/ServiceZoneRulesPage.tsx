import { ServiceZoneRulesTab } from '@/components/rate-management/ServiceZoneRulesTab';

export function ServiceZoneRulesPage() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Service Zone Rules</h1>
        <p className="text-sm text-muted-foreground">
          Map client, product, verification type, pincode, and area combinations to a rate type
          before pricing is applied.
        </p>
      </div>
      <ServiceZoneRulesTab />
    </div>
  );
}
