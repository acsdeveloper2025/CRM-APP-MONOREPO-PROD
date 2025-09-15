import React, { useState, useEffect } from 'react';
import { Bell, Clock, Smartphone, Monitor, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface NotificationPreferences {
  userId: string;
  caseAssignmentEnabled: boolean;
  caseAssignmentPush: boolean;
  caseAssignmentWebsocket: boolean;
  caseReassignmentEnabled: boolean;
  caseReassignmentPush: boolean;
  caseReassignmentWebsocket: boolean;
  caseCompletionEnabled: boolean;
  caseCompletionPush: boolean;
  caseCompletionWebsocket: boolean;
  caseRevocationEnabled: boolean;
  caseRevocationPush: boolean;
  caseRevocationWebsocket: boolean;
  systemNotificationsEnabled: boolean;
  systemNotificationsPush: boolean;
  systemNotificationsWebsocket: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  createdAt: string;
  updatedAt: string;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/notifications/preferences');
      if (response.success) {
        setPreferences(response.data);
      } else {
        toast.error('Failed to load notification preferences');
      }
    } catch (error) {
      console.error('Load preferences error:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean | string) => {
    if (!preferences) return;
    
    setPreferences(prev => ({
      ...prev!,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const savePreferences = async () => {
    if (!preferences || !hasChanges) return;

    try {
      setSaving(true);
      const response = await apiService.put('/notifications/preferences', preferences);
      if (response.success) {
        setHasChanges(false);
        toast.success('Notification preferences saved successfully');
      } else {
        toast.error('Failed to save notification preferences');
      }
    } catch (error) {
      console.error('Save preferences error:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (!preferences) return;
    
    setPreferences(prev => ({
      ...prev!,
      caseAssignmentEnabled: true,
      caseAssignmentPush: true,
      caseAssignmentWebsocket: true,
      caseReassignmentEnabled: true,
      caseReassignmentPush: true,
      caseReassignmentWebsocket: true,
      caseCompletionEnabled: true,
      caseCompletionPush: false,
      caseCompletionWebsocket: true,
      caseRevocationEnabled: true,
      caseRevocationPush: true,
      caseRevocationWebsocket: true,
      systemNotificationsEnabled: true,
      systemNotificationsPush: false,
      systemNotificationsWebsocket: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">Failed to load notification preferences</p>
          <Button onClick={loadPreferences} className="mt-2">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Preferences</h2>
          <p className="text-muted-foreground">
            Customize how and when you receive notifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Unsaved Changes
            </Badge>
          )}
          <Button
            onClick={resetToDefaults}
            variant="outline"
            size="sm"
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={savePreferences}
            disabled={!hasChanges || saving}
            size="sm"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Case Assignment Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2 text-blue-600" />
            Case Assignment Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications when cases are assigned or reassigned to you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="case-assignment-enabled" className="text-sm font-medium">
              Enable case assignment notifications
            </Label>
            <Switch
              id="case-assignment-enabled"
              checked={preferences.caseAssignmentEnabled}
              onCheckedChange={(checked) => updatePreference('caseAssignmentEnabled', checked)}
            />
          </div>
          
          {preferences.caseAssignmentEnabled && (
            <div className="ml-4 space-y-3 border-l-2 border-border pl-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Push notifications
                </Label>
                <Switch
                  checked={preferences.caseAssignmentPush}
                  onCheckedChange={(checked) => updatePreference('caseAssignmentPush', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  Real-time web notifications
                </Label>
                <Switch
                  checked={preferences.caseAssignmentWebsocket}
                  onCheckedChange={(checked) => updatePreference('caseAssignmentWebsocket', checked)}
                />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="case-reassignment-enabled" className="text-sm font-medium">
              Enable case reassignment notifications
            </Label>
            <Switch
              id="case-reassignment-enabled"
              checked={preferences.caseReassignmentEnabled}
              onCheckedChange={(checked) => updatePreference('caseReassignmentEnabled', checked)}
            />
          </div>
          
          {preferences.caseReassignmentEnabled && (
            <div className="ml-4 space-y-3 border-l-2 border-border pl-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Push notifications
                </Label>
                <Switch
                  checked={preferences.caseReassignmentPush}
                  onCheckedChange={(checked) => updatePreference('caseReassignmentPush', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  Real-time web notifications
                </Label>
                <Switch
                  checked={preferences.caseReassignmentWebsocket}
                  onCheckedChange={(checked) => updatePreference('caseReassignmentWebsocket', checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case Status Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
            Case Status Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications about case completions and revocations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="case-completion-enabled" className="text-sm font-medium">
              Enable case completion notifications
            </Label>
            <Switch
              id="case-completion-enabled"
              checked={preferences.caseCompletionEnabled}
              onCheckedChange={(checked) => updatePreference('caseCompletionEnabled', checked)}
            />
          </div>
          
          {preferences.caseCompletionEnabled && (
            <div className="ml-4 space-y-3 border-l-2 border-border pl-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Push notifications
                </Label>
                <Switch
                  checked={preferences.caseCompletionPush}
                  onCheckedChange={(checked) => updatePreference('caseCompletionPush', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  Real-time web notifications
                </Label>
                <Switch
                  checked={preferences.caseCompletionWebsocket}
                  onCheckedChange={(checked) => updatePreference('caseCompletionWebsocket', checked)}
                />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="case-revocation-enabled" className="text-sm font-medium">
              Enable case revocation notifications
            </Label>
            <Switch
              id="case-revocation-enabled"
              checked={preferences.caseRevocationEnabled}
              onCheckedChange={(checked) => updatePreference('caseRevocationEnabled', checked)}
            />
          </div>
          
          {preferences.caseRevocationEnabled && (
            <div className="ml-4 space-y-3 border-l-2 border-border pl-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Push notifications
                </Label>
                <Switch
                  checked={preferences.caseRevocationPush}
                  onCheckedChange={(checked) => updatePreference('caseRevocationPush', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  Real-time web notifications
                </Label>
                <Switch
                  checked={preferences.caseRevocationWebsocket}
                  onCheckedChange={(checked) => updatePreference('caseRevocationWebsocket', checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-orange-600" />
            System Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications about system updates and maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="system-notifications-enabled" className="text-sm font-medium">
              Enable system notifications
            </Label>
            <Switch
              id="system-notifications-enabled"
              checked={preferences.systemNotificationsEnabled}
              onCheckedChange={(checked) => updatePreference('systemNotificationsEnabled', checked)}
            />
          </div>
          
          {preferences.systemNotificationsEnabled && (
            <div className="ml-4 space-y-3 border-l-2 border-border pl-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Push notifications
                </Label>
                <Switch
                  checked={preferences.systemNotificationsPush}
                  onCheckedChange={(checked) => updatePreference('systemNotificationsPush', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  Real-time web notifications
                </Label>
                <Switch
                  checked={preferences.systemNotificationsWebsocket}
                  onCheckedChange={(checked) => updatePreference('systemNotificationsWebsocket', checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-purple-600" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set quiet hours to avoid receiving notifications during specific times
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours-enabled" className="text-sm font-medium">
              Enable quiet hours
            </Label>
            <Switch
              id="quiet-hours-enabled"
              checked={preferences.quietHoursEnabled}
              onCheckedChange={(checked) => updatePreference('quietHoursEnabled', checked)}
            />
          </div>
          
          {preferences.quietHoursEnabled && (
            <div className="ml-4 space-y-3 border-l-2 border-border pl-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quiet-hours-start" className="text-sm">
                    Start time
                  </Label>
                  <Input
                    id="quiet-hours-start"
                    type="time"
                    value={preferences.quietHoursStart}
                    onChange={(e) => updatePreference('quietHoursStart', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="quiet-hours-end" className="text-sm">
                    End time
                  </Label>
                  <Input
                    id="quiet-hours-end"
                    type="time"
                    value={preferences.quietHoursEnd}
                    onChange={(e) => updatePreference('quietHoursEnd', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                During quiet hours, you'll only receive urgent notifications
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
