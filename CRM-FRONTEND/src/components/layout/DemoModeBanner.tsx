import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useActiveScope } from '@/hooks/useActiveScope';
import { useClients, useProducts } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';

/**
 * Persistent yellow banner shown while Demo Mode is active. Surfaces the
 * locked scope (client / product names) and an Unlock button. Renders
 * nothing when not in demo mode.
 *
 * project_scope_control_audit_2026_05_14.md P7.
 */
export const DemoModeBanner: React.FC = () => {
  const { isDemoMode, selectedClientId, selectedProductId, unlockScope } = useActiveScope();
  const { data: clientsResponse } = useClients({ page: 1, limit: 100 });
  const { data: productsResponse } = useProducts({ page: 1, limit: 100 });
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isDemoMode) {
    return null;
  }

  const clientName = clientsResponse?.data?.find((c) => c.id === selectedClientId)?.name ?? '—';
  const productName =
    selectedProductId != null
      ? (productsResponse?.data?.find((p) => p.id === selectedProductId)?.name ?? '—')
      : 'all products';

  return (
    <>
      <div
        className="bg-amber-400 text-amber-950 px-4 py-1.5 text-xs sm:text-sm flex items-center justify-between gap-3"
        role="status"
        data-testid="demo-mode-banner"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium truncate">
            Demo Mode — locked to <strong>{clientName}</strong> / <strong>{productName}</strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-amber-950 hover:bg-amber-500/30"
          onClick={() => setConfirmOpen(true)}
        >
          <Unlock className="h-3.5 w-3.5 mr-1" />
          Unlock
        </Button>
      </div>
      <PasswordConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        intent="unlock"
        title="Exit Demo Mode?"
        description={`Enter your password to exit Demo Mode. You will be able to switch between clients and products again. The current scope (${clientName}) stays selected.`}
        confirmLabel="Exit Demo Mode"
        onSuccess={unlockScope}
      />
    </>
  );
};
