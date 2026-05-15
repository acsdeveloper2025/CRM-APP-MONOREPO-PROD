import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * P19/C-6: ReportsPage parent route is now a redirect to the canonical
 * working sub-page (`MIS Dashboard`).
 *
 * The previous implementation rendered four tabs whose data came from
 * BE routes that don't exist — `/mis-reports*`,
 * `/reports/turnaround-time`, `/reports/completion-rate` — so every
 * stat card, table, and chart silently 404'd. The user had no way to
 * tell the difference between "no data" and "endpoint missing", and
 * the Generate / Delete / Download actions on the MIS Reports tab
 * silently failed every time.
 *
 * The sidebar nav already exposes the working sub-pages directly:
 * `/reports-and-mis/analytics-dashboard` (AnalyticsPage) and
 * `/reports-and-mis/mis-dashboard` (MISDashboardPage). Keep clicking
 * the parent header land on a working surface instead of the dead
 * tab grid.
 *
 * Audit: project_full_app_audit_2026_05_14.md C-6 (deferred from
 * P17, closed in P19).
 */
export const ReportsPage: React.FC = () => {
  return <Navigate to="/reports-and-mis/mis-dashboard" replace />;
};

export default ReportsPage;
