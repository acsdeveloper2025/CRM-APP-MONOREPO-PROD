import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useActiveScope } from '@/hooks/useActiveScope';
import { useClients, useProducts, useProductsByClient } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';

const ALL_VALUE = '__all__';

/**
 * Global Active Scope selector — narrows visible data to a chosen client /
 * product across the entire app. Per project_scope_control_audit_2026_05_14.md
 * (P4). Backend honors X-Active-Client-Id / X-Active-Product-Id headers
 * attached by services/api.ts.
 *
 * Source data: /api/clients and /api/products are marked crossTenant on
 * the backend so the list itself is NOT narrowed by the chosen scope —
 * the user can switch back to other clients without losing options.
 */
export const ScopeSelector: React.FC = () => {
  const { selectedClientId, selectedProductId, isDemoMode, setScope, lockScope } = useActiveScope();
  const { data: clientsResponse } = useClients({ page: 1, limit: 100 });
  // When a client is selected, narrow the Product dropdown to only the
  // products mapped to that client via client_products. When no client
  // is picked ("All clients"), keep the global list so the user can see
  // every option before drilling in.
  const { data: globalProductsResponse } = useProducts({ page: 1, limit: 100 });
  const { data: clientProductsResponse } = useProductsByClient(
    selectedClientId != null ? String(selectedClientId) : undefined
  );
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);

  const clients = clientsResponse?.data ?? [];
  const products =
    selectedClientId != null
      ? (clientProductsResponse?.data ?? [])
      : (globalProductsResponse?.data ?? []);

  // Hide the selector when the user has at most one accessible client —
  // there is nothing to narrow. Auto-pin happens implicitly via the
  // backend's existing addClientFiltering middleware.
  if (clients.length <= 1) {
    return null;
  }

  const onClientChange = (value: string) => {
    setScope({
      selectedClientId: value === ALL_VALUE ? null : Number(value),
      // Reset product on client change — keeps semantics simple and
      // avoids stale (clientA × productB) pairings.
      selectedProductId: null,
    });
  };

  const onProductChange = (value: string) => {
    setScope({
      selectedProductId: value === ALL_VALUE ? null : Number(value),
    });
  };

  const selectedClientName =
    selectedClientId != null ? (clients.find((c) => c.id === selectedClientId)?.name ?? '') : '';

  const canLock = selectedClientId != null && !isDemoMode;

  return (
    <>
      <div className="hidden lg:flex items-center gap-2" data-testid="scope-selector">
        <Select
          value={selectedClientId != null ? String(selectedClientId) : ALL_VALUE}
          onValueChange={onClientChange}
          disabled={isDemoMode}
        >
          <SelectTrigger className="h-8 w-40 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 focus:ring-white/40 disabled:opacity-70 disabled:cursor-not-allowed">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {products.length > 1 && (
          <Select
            value={selectedProductId != null ? String(selectedProductId) : ALL_VALUE}
            onValueChange={onProductChange}
            disabled={isDemoMode}
          >
            <SelectTrigger className="h-8 w-40 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 focus:ring-white/40 disabled:opacity-70 disabled:cursor-not-allowed">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canLock && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setLockConfirmOpen(true)}
            aria-label="Lock scope (enter Demo Mode)"
            title="Lock scope — prevents accidental switching during demos"
          >
            <Lock className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PasswordConfirmDialog
        open={lockConfirmOpen}
        onOpenChange={setLockConfirmOpen}
        intent="lock"
        title={`Lock to ${selectedClientName}?`}
        description="Demo Mode prevents accidental scope switching during live client demos. Enter your password to confirm. Dropdowns will be disabled and a yellow banner will indicate the locked scope until you unlock."
        confirmLabel="Enter Demo Mode"
        onSuccess={lockScope}
      />
    </>
  );
};
