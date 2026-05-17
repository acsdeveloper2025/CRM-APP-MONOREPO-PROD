import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Download, FileCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { apiService } from '@/services/api';
import { usersService } from '@/services/users';
import {
  CURRENT_POLICY_VERSION,
  FIELD_EXECUTIVE_ACKNOWLEDGEMENT,
} from '@/constants/fieldExecutiveAcknowledgement';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface Props {
  userId: string;
  userName: string;
}

const formatWhen = (iso: string): string => {
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
};

export function PrivacyTab({ userId, userName }: Props) {
  const queryClient = useQueryClient();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: consentsResponse, isLoading } = useQuery({
    queryKey: ['my-consents', userId],
    queryFn: () => usersService.getUserConsents(userId),
  });
  const consents = consentsResponse?.data ?? [];
  const latestConsent = consents[0];
  // Type-narrowing helper — keeps the JSX guards trivial and avoids
  // non-null assertions (banned by FE rule set).
  const currentAcceptance =
    latestConsent && Number(latestConsent.policyVersion) === CURRENT_POLICY_VERSION
      ? latestConsent
      : null;
  const acceptedCurrent = currentAcceptance !== null;

  const acceptMutation = useStandardizedMutation({
    mutationFn: () => usersService.acceptConsent(CURRENT_POLICY_VERSION),
    successMessage: 'Acknowledgement recorded',
    errorContext: 'Accept Policy',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-consents', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-consents', userId] });
      setPolicyOpen(false);
    },
  });

  const handleDownloadData = async () => {
    setDownloading(true);
    try {
      // DPDP §11 — BE renders the full bundle to A4 PDF via puppeteer
      // (2026-05-17: was JSON; switched per user feedback so the data
      // principal receives a single print-ready artifact).
      const blob = await apiService.getBlob(`/users/${userId}/data-export`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${userName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Your data export downloaded');
    } catch (err) {
      logger.error('Data export download failed', err);
      toast.error('Failed to download your data. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {/* Acknowledgement card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-muted-foreground" />
              Policy Acknowledgement
            </CardTitle>
            <CardDescription>
              Field Executive Acknowledgement — Code of Conduct, Anti-Bribery, NDA, Privacy consent.
              Recorded for compliance review and dispute resolution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading acceptance history…</p>
            ) : currentAcceptance ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      You accepted version {currentAcceptance.policyVersion} on{' '}
                      {formatWhen(currentAcceptance.acceptedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground case-sensitive">
                      via {currentAcceptance.source}
                      {currentAcceptance.ipAddress ? ` · ${currentAcceptance.ipAddress}` : ''}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPolicyOpen(true)}>
                  View Policy
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      You have not accepted the current policy (version {CURRENT_POLICY_VERSION}).
                    </p>
                    {latestConsent && (
                      <p className="text-xs text-muted-foreground">
                        Last accepted version {latestConsent.policyVersion} on{' '}
                        {formatWhen(latestConsent.acceptedAt)}.
                      </p>
                    )}
                  </div>
                </div>
                <Button onClick={() => setPolicyOpen(true)} className="self-start sm:self-auto">
                  Review & Accept
                </Button>
              </div>
            )}

            {consents.length > 1 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Acceptance history</p>
                  <ul className="space-y-1.5">
                    {consents.slice(1).map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-muted-foreground">
                          v{c.policyVersion} · {formatWhen(c.acceptedAt)}
                        </span>
                        <Badge variant="secondary" className="case-sensitive">
                          {c.source}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* DPDP §11 data export card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              Download My Data
            </CardTitle>
            <CardDescription>
              DPDP §11 right of access. Generates a print-ready PDF of your account, role,
              assignments, consents, devices, and notification preferences. Sensitive secrets
              (password hash, raw push tokens) are excluded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadData} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" />
              {downloading ? 'Preparing…' : 'Download My Data (PDF)'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Policy view + accept dialog */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Field Executive Acknowledgement</DialogTitle>
            <DialogDescription>
              Please read the full policy. Acceptance is recorded with timestamp, IP address, and
              user agent.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap font-sans text-xs case-sensitive text-foreground">
              {FIELD_EXECUTIVE_ACKNOWLEDGEMENT}
            </pre>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPolicyOpen(false)}
              disabled={acceptMutation.isPending}
            >
              Close
            </Button>
            {!acceptedCurrent && (
              <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
                {acceptMutation.isPending ? 'Recording…' : 'I Accept'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
