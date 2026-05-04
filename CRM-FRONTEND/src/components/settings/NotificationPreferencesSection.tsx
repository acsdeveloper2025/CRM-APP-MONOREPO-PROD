import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { notificationService, type NotificationPreferences } from '@/services/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { toast } from 'sonner';
import { Save, RefreshCw } from 'lucide-react';

/**
 * Phase 1.3 (2026-05-04) — replaces the stub mock toggles with a real
 * wire-up to backend `/notifications/preferences`. Mirrors the
 * `notification_preferences` table: 5 event types × 3 channels
 * (enabled / push / websocket) + quiet hours (HH:MM start + end).
 *
 * Backend auto-creates the row with safe defaults on first GET, so a
 * brand-new user opens this screen and sees toggles already populated.
 */
const EVENT_TYPES: Array<{
  key:
    | 'caseAssignment'
    | 'caseReassignment'
    | 'caseCompletion'
    | 'caseRevocation'
    | 'systemNotifications';
  label: string;
  description: string;
}> = [
  {
    key: 'caseAssignment',
    label: 'Case Assignment',
    description: 'When a case or task is newly assigned to you.',
  },
  {
    key: 'caseReassignment',
    label: 'Case Reassignment',
    description: 'When an existing case is reassigned to you.',
  },
  {
    key: 'caseCompletion',
    label: 'Case Completion',
    description: 'When a case you created or oversee is completed.',
  },
  {
    key: 'caseRevocation',
    label: 'Case / Task Revoked',
    description: 'When a case or task is revoked.',
  },
  {
    key: 'systemNotifications',
    label: 'System Alerts',
    description: 'Maintenance windows, app updates, urgent notices.',
  },
];

type FieldName = keyof NotificationPreferences;

const fieldName = (
  prefix: (typeof EVENT_TYPES)[number]['key'],
  suffix: 'Enabled' | 'Push' | 'Websocket'
): FieldName => `${prefix}${suffix}` as FieldName;

export const NotificationPreferencesSection: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationService.getPreferences(),
    staleTime: 60_000,
  });

  // Local mirror so users can toggle multiple switches before clicking
  // Save. We hydrate from server data on first load + after each successful
  // save.
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (data?.data) {
      setPrefs(data.data);
    }
  }, [data]);

  const mutation = useMutationWithInvalidation({
    mutationFn: (payload: Partial<NotificationPreferences>) =>
      notificationService.updatePreferences(payload),
    invalidateKeys: [['notification-preferences']],
    onSuccess: () => {
      toast.success('Notification preferences saved');
    },
    onError: () => {
      toast.error('Failed to save notification preferences');
    },
  });

  if (isLoading || !prefs) {
    return <LoadingState message="Loading notification preferences..." />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <p>Could not load notification preferences.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const setBool = (field: FieldName, value: boolean) => {
    setPrefs((curr) => (curr ? { ...curr, [field]: value } : curr));
  };

  const setQuietTime = (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    setPrefs((curr) => (curr ? { ...curr, [field]: value || null } : curr));
  };

  const handleSave = () => {
    if (!prefs) {
      return;
    }
    mutation.mutate(prefs);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="hidden md:grid grid-cols-12 gap-4 text-xs uppercase tracking-wider text-muted-foreground pb-2 border-b mb-2">
            <div className="col-span-6">Event</div>
            <div className="col-span-2 text-center">Enabled</div>
            <div className="col-span-2 text-center">Push (mobile)</div>
            <div className="col-span-2 text-center">In-app (web)</div>
          </div>

          {EVENT_TYPES.map(({ key, label, description }) => {
            const enabledField = fieldName(key, 'Enabled');
            const pushField = fieldName(key, 'Push');
            const wsField = fieldName(key, 'Websocket');
            const isEnabled = Boolean(prefs[enabledField]);
            return (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 border-b last:border-b-0"
              >
                <div className="md:col-span-6">
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <div className="md:col-span-2 flex md:justify-center items-center gap-2">
                  <Switch checked={isEnabled} onCheckedChange={(v) => setBool(enabledField, v)} />
                  <span className="text-sm md:hidden">Enabled</span>
                </div>
                <div className="md:col-span-2 flex md:justify-center items-center gap-2">
                  <Switch
                    checked={Boolean(prefs[pushField])}
                    disabled={!isEnabled}
                    onCheckedChange={(v) => setBool(pushField, v)}
                  />
                  <span className="text-sm md:hidden">Push</span>
                </div>
                <div className="md:col-span-2 flex md:justify-center items-center gap-2">
                  <Switch
                    checked={Boolean(prefs[wsField])}
                    disabled={!isEnabled}
                    onCheckedChange={(v) => setBool(wsField, v)}
                  />
                  <span className="text-sm md:hidden">In-app</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Quiet Hours
            {prefs.quietHoursEnabled && (
              <Badge variant="secondary">
                {prefs.quietHoursStart || '--:--'} – {prefs.quietHoursEnd || '--:--'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mute non-urgent notifications</p>
              <p className="text-sm text-muted-foreground">
                Push and in-app alerts pause during this window. Urgent alerts still fire.
              </p>
            </div>
            <Switch
              checked={prefs.quietHoursEnabled}
              onCheckedChange={(v) => setBool('quietHoursEnabled', v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quiet-start">Start (24h)</Label>
              <Input
                id="quiet-start"
                type="time"
                value={prefs.quietHoursStart || ''}
                disabled={!prefs.quietHoursEnabled}
                onChange={(e) => setQuietTime('quietHoursStart', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="quiet-end">End (24h)</Label>
              <Input
                id="quiet-end"
                type="time"
                value={prefs.quietHoursEnd || ''}
                disabled={!prefs.quietHoursEnabled}
                onChange={(e) => setQuietTime('quietHoursEnd', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Notification Preferences
        </Button>
      </div>
    </div>
  );
};
