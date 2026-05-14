import React from 'react';
import { useActiveScope } from '@/hooks/useActiveScope';
import { useClients, useProducts } from '@/hooks/useClients';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const { selectedClientId, selectedProductId, setScope } = useActiveScope();
  const { data: clientsResponse } = useClients({ page: 1, limit: 100 });
  const { data: productsResponse } = useProducts({ page: 1, limit: 100 });

  const clients = clientsResponse?.data ?? [];
  const products = productsResponse?.data ?? [];

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

  return (
    <div className="hidden lg:flex items-center gap-2" data-testid="scope-selector">
      <Select
        value={selectedClientId != null ? String(selectedClientId) : ALL_VALUE}
        onValueChange={onClientChange}
      >
        <SelectTrigger className="h-8 w-40 bg-white/10 text-white border-white/20 hover:bg-white/20 focus:ring-white/40">
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
        >
          <SelectTrigger className="h-8 w-40 bg-white/10 text-white border-white/20 hover:bg-white/20 focus:ring-white/40">
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
    </div>
  );
};
