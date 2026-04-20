import { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { reportTemplatesService } from '@/services/reportTemplates';
import { reportBrandingStore, useReportBranding } from '@/stores/reportBrandingStore';

interface GenerateReportWithBrandingDialogProps {
  caseId: string | number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_BRANDING_BYTES = 2 * 1024 * 1024;

function FileSlot({
  label,
  file,
  onPick,
  onClear,
  inputId,
}: {
  label: string;
  file: File | null;
  onPick: (f: File) => void;
  onClear: () => void;
  inputId: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm border bg-background">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="max-h-16 max-w-16 object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">none</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs" title={file?.name}>
            {file?.name ?? 'No file chosen'}
          </p>
          {file && (
            <p className="text-[11px] text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown type'}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (!picked) {
                return;
              }
              if (picked.size > MAX_BRANDING_BYTES) {
                toast.error(`${label} exceeds ${MAX_BRANDING_BYTES / 1024 / 1024} MB limit`);
                return;
              }
              onPick(picked);
              // Reset the input so picking the same file twice still fires onChange.
              if (inputRef.current) {
                inputRef.current.value = '';
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {file ? 'Replace' : 'Choose'}
          </Button>
          {file && (
            <Button type="button" variant="ghost" size="icon" onClick={onClear} title="Remove">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GenerateReportWithBrandingDialog({
  caseId,
  open,
  onOpenChange,
}: GenerateReportWithBrandingDialogProps) {
  const { logo, stamp } = useReportBranding();
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const { blob, filename } = await reportTemplatesService.generate(String(caseId), {
        logo,
        stamp,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success('Report downloaded');
      onOpenChange(false);
    } catch (err) {
      const fallbackMsg = 'Failed to download report';
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
            // Binary body that isn't JSON — fall through to status-based message.
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Optionally attach a logo and stamp to stamp onto this report. Choices are remembered for
            this browser session so you don&apos;t re-pick for each case. Files are not saved
            anywhere — they&apos;re embedded into this PDF only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FileSlot
            label="Logo"
            inputId="report-branding-logo"
            file={logo}
            onPick={(f) => reportBrandingStore.setLogo(f)}
            onClear={() => reportBrandingStore.setLogo(null)}
          />
          <FileSlot
            label="Stamp / Signature"
            inputId="report-branding-stamp"
            file={stamp}
            onPick={(f) => reportBrandingStore.setStamp(f)}
            onClear={() => reportBrandingStore.setStamp(null)}
          />
          <p className="text-xs text-muted-foreground">
            Max 2 MB per file. PNG with transparency recommended for clean overlay.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleGenerate()} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Generate &amp; Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
