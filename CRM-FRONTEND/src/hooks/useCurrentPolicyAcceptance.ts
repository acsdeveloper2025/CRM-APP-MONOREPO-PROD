import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usersService } from '@/services/users';
import { CURRENT_POLICY_VERSION } from '@/constants/fieldExecutiveAcknowledgement';

/**
 * Resolves whether the currently-authenticated user has accepted the
 * CURRENT_POLICY_VERSION. Reused by:
 *   - PolicyAcceptanceGuard (route-level redirect to /accept-policy)
 *   - AcceptPolicyPage (post-accept redirect when already accepted)
 *   - PrivacyTab (status badge)
 *
 * Returns { isAccepted, isLoading, isError, refetch }.
 *
 * Cached at staleTime 60s — acceptance is a low-mutation read; we don't
 * want every route navigation to hit BE for the check.
 */
export function useCurrentPolicyAcceptance(): {
  isAccepted: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-consents', userId],
    queryFn: () => usersService.getUserConsents(userId),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    // Don't retry on 4xx — the policy gate is a per-render check and
    // spamming 401/403 floods the network panel + the BE audit log
    // (witnessed 72+ duplicate calls in pre-fix testing 2026-05-17).
    retry: 0,
  });

  const consents = data?.data ?? [];
  const latest = consents[0];
  const isAccepted = !!latest && Number(latest.policyVersion) === CURRENT_POLICY_VERSION;

  return { isAccepted, isLoading, isError, refetch };
}
