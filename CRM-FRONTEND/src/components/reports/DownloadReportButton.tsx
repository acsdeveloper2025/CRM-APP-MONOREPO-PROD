import { useState } from 'react';
import { AxiosError } from 'axios';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportTemplatesService } from '@/services/reportTemplates';
import { usePermissionContext } from '@/contexts/PermissionContext';
import { toast } from 'sonner';

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
 * Triggers a PDF download for a case using the client+product's active
 * report template. Translates backend 404 responses (missing template,
 * missing case) into clear user toasts instead of surfacing raw Axios
 * errors.
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
  const [busy, setBusy] = useState(false);
  const { hasPermissionCode } = usePermissionContext();

  // Hide the button entirely for users who can't generate reports. The
  // backend's authorize('report.generate') guard is the real enforcer;
  // this is a UX nicety so users without the permission don't see a
  // button that would only ever 403.
  if (!hasPermissionCode('report.generate')) {
    return null;
  }

  const isIcon = size === 'icon';

  const handleClick = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const { blob, filename } = await reportTemplatesService.generate(String(caseId));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke on next tick so the browser has time to begin the download.
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success('Report downloaded');
    } catch (err) {
      const fallbackMsg = 'Failed to download report';
      // The generate endpoint returns application/pdf on success, JSON on error.
      // When axios is in responseType: 'blob' mode the error body is also a Blob,
      // so we need to parse it to surface a useful message.
      if (err instanceof AxiosError && err.response) {
        const { status } = err.response;
        let serverMsg = '';
        const rawBody = err.response.data as Blob | { message?: string } | undefined;
        if (rawBody instanceof Blob) {
          try {
            const text = await rawBody.text();
            const parsed = JSON.parse(text) as { message?: string; error?: { code?: string } };
            serverMsg = parsed.message ?? parsed.error?.code ?? '';
          } catch {
            // Binary body that wasn't JSON - fall through to status-based message.
          }
        } else if (rawBody && typeof rawBody === 'object' && 'message' in rawBody) {
          serverMsg = rawBody.message ?? '';
        }

        if (status === 404) {
          toast.error(serverMsg || 'No active report template for this client / product');
        } else if (status === 403) {
          toast.error('You do not have permission to generate reports');
        } else {
          toast.error(serverMsg || `${fallbackMsg} (HTTP ${status})`);
        }
      } else {
        toast.error(fallbackMsg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      aria-label={isIcon ? label : undefined}
      title={isIcon ? label : undefined}
    >
      {busy ? (
        <Loader2 className={isIcon ? 'h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />
      ) : (
        <Download className={isIcon ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
      )}
      {!isIcon && (busy ? 'Generating...' : label)}
    </Button>
  );
}
