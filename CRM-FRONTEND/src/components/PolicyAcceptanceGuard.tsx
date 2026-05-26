import { Navigate, useLocation } from 'react-router-dom';
import { LoadingPage } from '@/components/ui/loading';
import { useCurrentPolicyAcceptance } from '@/hooks/useCurrentPolicyAcceptance';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

// F9.3 (2026-05-26): Field Executive Acknowledgement is field-work-specific
// (visit.start / visit.upload / visit.submit holders). Desk roles (KYC
// verifier, admin, manager) shouldn't be forced to accept a policy that
// describes field-agent obligations. Gate by visit.* permission presence.
const FIELD_EXECUTION_PERMS = [
  'visit.start',
  'visit.upload',
  'visit.submit',
  'visit.revoke',
  'visit.revisit',
];

/**
 * Hard login gate (Phase D Option B, 2026-05-17): every authenticated
 * route is gated behind acceptance of the current policy version. Users
 * who have not accepted (OR whose acceptance can't be verified) are
 * redirected to /accept-policy.
 *
 * Mounted INSIDE AuthenticatedLayout, AFTER ProtectedRoute has confirmed
 * the user is logged in. /accept-policy itself sits OUTSIDE this layout
 * to avoid an infinite redirect loop.
 *
 * Fail-CLOSED on error: original design failed open ("transient outage
 * shouldn't lock org out"), but a pre-prod test (2026-05-17) revealed
 * that non-admin users hit 403 on the consent endpoint, which fail-open
 * silently bypassed the gate entirely. Correct posture for a compliance
 * gate is to assume unverified = unaccepted and route to /accept-policy
 * where the user can either accept (one button) or logout (other).
 */
export function PolicyAcceptanceGuard({ children }: Props) {
  const { user } = useAuth();
  const { isAccepted, isLoading } = useCurrentPolicyAcceptance();
  const location = useLocation();

  // F9.3: only field execution actors must accept the Field Executive
  // Acknowledgement. Desk users (KYC verifier, admin, manager, etc.) pass
  // through. Detection by presence of any visit.* permission code.
  const perms = ((user as { permissions?: string[] })?.permissions ?? []) as string[];
  const isFieldExec = FIELD_EXECUTION_PERMS.some((code) => perms.includes(code));
  if (!isFieldExec) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <LoadingPage
        title="Checking acknowledgements"
        description="Verifying your policy acceptance status…"
      />
    );
  }

  if (!isAccepted) {
    return <Navigate to="/accept-policy" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
