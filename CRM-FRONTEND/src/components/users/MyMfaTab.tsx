// T1-2 (audit 2026-05-17): Two-factor authentication tab on /profile.
//
// Three states the user lands on:
//   - status loading            → skeleton
//   - enrolled                  → enrolled card + reset-via-admin note
//   - not enrolled (any user)   → Enroll button → dialog flow (start →
//                                  QR + secret → verify → recovery codes)
//
// Self-disable is intentionally NOT exposed — a hijacked session
// disabling MFA defeats the whole point. Recovery requires an admin
// running POST /api/auth/mfa/disable/:userId. The tab states this
// explicitly so users know who to contact.

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/ui/loading';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { ShieldCheck, ShieldAlert, Copy } from 'lucide-react';
import type {
  MfaStatusResponse,
  MfaEnrollStartResponse,
  MfaEnrollVerifyResponse,
} from '@/types/auth';

export function MyMfaTab() {
  const queryClient = useQueryClient();
  const [enrollOpen, setEnrollOpen] = useState(false);

  const statusQuery = useQuery<MfaStatusResponse>({
    queryKey: ['mfa-status'],
    queryFn: async () => {
      const res = await apiService.get<MfaStatusResponse>('/auth/mfa/status');
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to load MFA status');
      }
      return res.data;
    },
    staleTime: 0,
  });

  if (statusQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Loading status…</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton height="6rem" />
        </CardContent>
      </Card>
    );
  }

  if (statusQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription className="text-destructive">Could not load MFA status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => statusQuery.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = statusQuery.data;
  if (!status) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Adds a 6-digit code from your authenticator app at sign-in.
              </CardDescription>
            </div>
            {status.enrolled ? (
              <Badge className="self-start" variant="default">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                Enrolled
              </Badge>
            ) : (
              <Badge className="self-start" variant="secondary">
                <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                Not enrolled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.enrolled ? (
            <p className="text-sm text-muted-foreground">
              You are protected by a second factor. To reset enrollment (lost device, switching
              authenticator app), contact your administrator — they can clear your MFA so you can
              re-enroll with the new device.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {status.mfaRequiredForUser
                  ? 'Your role requires MFA for sign-in. Enroll now so you are not locked out at the next session.'
                  : 'Optional today, recommended.'}
              </p>
              <Button onClick={() => setEnrollOpen(true)}>Enroll now</Button>
            </>
          )}
        </CardContent>
      </Card>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
          queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        }}
      />
    </>
  );
}

interface EnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

function EnrollDialog({ open, onOpenChange, onCompleted }: EnrollDialogProps) {
  const [step, setStep] = useState<'start' | 'verify' | 'recovery'>('start');
  const [secret, setSecret] = useState<string>('');
  const [otpauthUri, setOtpauthUri] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedAck, setSavedAck] = useState(false);

  // Reset state every time the dialog opens, so a closed-then-reopened
  // enrollment does not show stale codes / QR from a prior attempt.
  useEffect(() => {
    if (open) {
      setStep('start');
      setSecret('');
      setOtpauthUri('');
      setQrDataUrl('');
      setCode('');
      setRecoveryCodes([]);
      setSavedAck(false);
    }
  }, [open]);

  // Once the start endpoint returns the otpauth URI, render it to a
  // QR PNG data URL via the qrcode lib (computed locally — secret never
  // leaves the browser at this step).
  useEffect(() => {
    if (!otpauthUri) {
      return;
    }
    QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch((err) => {
        logger.error('QR render failed', err);
        toast.error('Could not render QR code. Use the secret below to set up manually.');
      });
  }, [otpauthUri]);

  const startMutation = useStandardizedMutation({
    mutationFn: async () => {
      const res = await apiService.post<MfaEnrollStartResponse>('/auth/mfa/enroll/start');
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Failed to start enrollment');
      }
      return res.data;
    },
    errorContext: 'MFA Enrollment',
    onSuccess: (data) => {
      setSecret(data.secret);
      setOtpauthUri(data.otpauthUri);
      setStep('verify');
    },
  });

  const verifyMutation = useStandardizedMutation({
    mutationFn: async (input: { secret: string; code: string }) => {
      const res = await apiService.post<MfaEnrollVerifyResponse>('/auth/mfa/enroll/verify', input);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Verification failed');
      }
      return res.data;
    },
    errorContext: 'MFA Verification',
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setStep('recovery');
    },
  });

  const verifyDisabled = useMemo(
    () => verifyMutation.isPending || !/^\d{6}$/.test(code.trim()),
    [verifyMutation.isPending, code]
  );

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      toast.success('Recovery codes copied to clipboard');
    } catch {
      toast.error('Could not copy — select the codes manually');
    }
  };

  const handleClose = () => {
    if (verifyMutation.isPending || startMutation.isPending) {
      return;
    }
    // Block dismissing the recovery step until the user confirms they
    // saved the codes — there is no second chance to view them.
    if (step === 'recovery' && !savedAck) {
      toast.error('Confirm you have saved your recovery codes first');
      return;
    }
    if (step === 'recovery' && savedAck) {
      onCompleted();
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        } else {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'start' && 'Set up two-factor authentication'}
            {step === 'verify' && 'Confirm your authenticator'}
            {step === 'recovery' && 'Save your recovery codes'}
          </DialogTitle>
          <DialogDescription>
            {step === 'start' &&
              'You will need an authenticator app (Google Authenticator, Authy, 1Password, etc.).'}
            {step === 'verify' &&
              'Scan the QR or paste the secret into your authenticator, then enter the 6-digit code it shows.'}
            {step === 'recovery' &&
              'These 10 codes are your only way back in if you lose your device. Each works exactly once.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'start' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When ready, click &ldquo;Generate&rdquo; to receive a one-time setup QR code. You will
              type one code to confirm before MFA goes live.
            </p>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="MFA QR code"
                  className="h-60 w-60 rounded-md border border-border bg-white p-2"
                />
              ) : (
                <LoadingSkeleton width="15rem" height="15rem" />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Manual entry secret</Label>
              <code className="case-sensitive block break-all rounded-md border border-border bg-white px-3 py-2 text-xs font-mono text-foreground">
                {secret}
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-code">6-digit code from your app</Label>
              <Input
                id="enroll-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="case-sensitive text-center text-lg tracking-widest"
              />
            </div>
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((rc) => (
                <code
                  key={rc}
                  className="case-sensitive rounded-md border border-border bg-white px-2 py-1.5 text-center text-xs font-mono text-foreground"
                >
                  {rc}
                </code>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={copyRecoveryCodes} className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              Copy all codes
            </Button>
            <label htmlFor="mfa-saved-ack" className="flex items-start gap-2 text-sm">
              <input
                id="mfa-saved-ack"
                type="checkbox"
                aria-label="I have saved my recovery codes"
                checked={savedAck}
                onChange={(e) => setSavedAck(e.target.checked)}
                className="mt-1"
              />
              <span>
                I have saved these codes in a safe place. I understand they will not be shown again.
              </span>
            </label>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {step !== 'recovery' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={startMutation.isPending || verifyMutation.isPending}
            >
              Cancel
            </Button>
          )}
          {step === 'start' && (
            <Button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
          )}
          {step === 'verify' && (
            <Button
              type="button"
              onClick={() => verifyMutation.mutate({ secret, code: code.trim() })}
              disabled={verifyDisabled}
            >
              {verifyMutation.isPending ? 'Verifying…' : 'Verify & enable'}
            </Button>
          )}
          {step === 'recovery' && (
            <Button type="button" onClick={handleClose} disabled={!savedAck}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
