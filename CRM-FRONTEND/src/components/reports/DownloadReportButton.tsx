import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { GenerateReportWithBrandingDialog } from './GenerateReportWithBrandingDialog';

interface DownloadReportButtonProps {
  /** Case UUID or numeric case_id. Required. */
  caseId: string | number;
  /** Button visual variant. Defaults to 'outline'. */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size. Defaults to 'default'. */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Optional label; hidden when size='icon'. Defaults to 'Download Report'. */
  label?: string;
  /** Additional CSS classes on the button. */
  className?: string;
  /** Disable the button while the parent is loading case data. */
  disabled?: boolean;
}

/**
 * Opens the Generate Report dialog, where the admin optionally attaches a
 * logo + stamp before the PDF is rendered and downloaded. Branding assets
 * are embedded into the PDF at render time only — nothing is persisted.
 *
 * Reusable across Case Detail, MIS table rows, and any future per-case
 * action surface.
 */
export function DownloadReportButton({
  caseId,
  variant = 'outline',
  size = 'default',
  label = 'Download Report',
  className,
  disabled,
}: DownloadReportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { hasPermissionCode } = usePermissionContext();

  // Hide the button entirely for users who can't generate reports. The
  // backend's authorize('report.generate') guard is the real enforcer;
  // this is a UX nicety so users without the permission don't see a
  // button that would only ever 403.
  if (!hasPermissionCode('report.generate')) {
    return null;
  }

  const isIcon = size === 'icon';

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        aria-label={isIcon ? label : undefined}
        title={isIcon ? label : undefined}
      >
        <Download className={isIcon ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
        {!isIcon && label}
      </Button>
      {dialogOpen && (
        <GenerateReportWithBrandingDialog
          caseId={caseId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  );
}
