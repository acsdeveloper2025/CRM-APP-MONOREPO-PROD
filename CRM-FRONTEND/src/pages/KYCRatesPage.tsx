import { DocumentTypeRatesTab } from '@/components/rate-management/DocumentTypeRatesTab';

export function KYCRatesPage() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">KYC Rates</h1>
        <p className="text-sm text-muted-foreground">
          Configure pricing for KYC document verification per client and product.
        </p>
      </div>
      <DocumentTypeRatesTab />
    </div>
  );
}
