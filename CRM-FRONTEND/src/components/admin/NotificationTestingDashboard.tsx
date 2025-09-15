import React, { useState, useEffect } from 'react';
import { Send, Activity, BarChart3, Wifi, WifiOff, TestTube, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface ConnectivityStatus {
  fcm: boolean;
  apns: boolean;
  timestamp: string;
}

interface NotificationAnalytics {
  byType: Array<{
    type: string;
    priority: string;
    total_sent: number;
    total_read: number;
    total_unread: number;
    read_rate: number;
    avg_read_time_seconds: number;
  }>;
  byDeliveryMethod: Array<{
    delivery_method: string;
    delivery_status: string;
    count: number;
  }>;
  summary: {
    totalNotifications: number;
    totalRead: number;
    totalUnread: number;
    overallReadRate: string;
  };
}

export function NotificationTestingDashboard() {
  const [connectivity, setConnectivity] = useState<ConnectivityStatus | null>(null);
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [testForm, setTestForm] = useState({
    title: '',
    message: '',
    type: 'TEST',
    priority: 'MEDIUM',
    targetUserId: '',
  });

  useEffect(() => {
    loadConnectivityStatus();
    loadAnalytics();
  }, []);

  const loadConnectivityStatus = async () => {
    try {
      const response = await apiService.get('/notifications/test/connectivity');
      if (response.success) {
        setConnectivity(response.data);
      }
    } catch (error) {
      console.error('Failed to load connectivity status:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await apiService.get('/notifications/analytics');
      if (response.success) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const sendTestNotification = async () => {
    if (!testForm.title || !testForm.message) {
      toast.error('Title and message are required');
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.post('/notifications/test', testForm);
      
      if (response.success) {
        toast.success('Test notification sent successfully');
        setTestForm({
          title: '',
          message: '',
          type: 'TEST',
          priority: 'MEDIUM',
          targetUserId: '',
        });
        // Reload analytics to show updated data
        setTimeout(loadAnalytics, 1000);
      } else {
        toast.error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Send test notification error:', error);
      toast.error('Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const refreshConnectivity = async () => {
    setConnectivity(null);
    await loadConnectivityStatus();
  };

  const refreshAnalytics = async () => {
    setAnalytics(null);
    await loadAnalytics();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Testing Dashboard</h2>
          <p className="text-muted-foreground">
            Test and monitor notification system performance
          </p>
        </div>
      </div>

      {/* Connectivity Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Push Notification Connectivity
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshConnectivity}
              className="ml-auto"
            >
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Status of push notification services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectivity ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                {connectivity.fcm ? (
                  <Wifi className="h-5 w-5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Firebase Cloud Messaging (FCM)</p>
                  <p className="text-sm text-muted-foreground">
                    Android & Web push notifications
                  </p>
                </div>
                <Badge variant={connectivity.fcm ? 'default' : 'destructive'}>
                  {connectivity.fcm ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div className="flex items-center space-x-3">
                {connectivity.apns ? (
                  <Wifi className="h-5 w-5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-600" />
                )}
                <div>
                  <p className="font-medium">Apple Push Notification Service (APNS)</p>
                  <p className="text-sm text-muted-foreground">
                    iOS push notifications
                  </p>
                </div>
                <Badge variant={connectivity.apns ? 'default' : 'destructive'}>
                  {connectivity.apns ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Notification Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TestTube className="h-5 w-5 mr-2" />
            Send Test Notification
          </CardTitle>
          <CardDescription>
            Send a test notification to verify the system is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Test notification title"
                value={testForm.title}
                onChange={(e) => setTestForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={testForm.type}
                onValueChange={(value) => setTestForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEST">Test</SelectItem>
                  <SelectItem value="CASE_ASSIGNED">Case Assignment</SelectItem>
                  <SelectItem value="CASE_COMPLETED">Case Completion</SelectItem>
                  <SelectItem value="SYSTEM_MAINTENANCE">System Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Test notification message"
              value={testForm.message}
              onChange={(e) => setTestForm(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={testForm.priority}
                onValueChange={(value) => setTestForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetUserId">Target User ID (Optional)</Label>
              <Input
                id="targetUserId"
                placeholder="Leave empty to send to yourself"
                value={testForm.targetUserId}
                onChange={(e) => setTestForm(prev => ({ ...prev, targetUserId: e.target.value }))}
              />
            </div>
          </div>

          <Button
            onClick={sendTestNotification}
            disabled={loading || !testForm.title || !testForm.message}
            className="w-full"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Notification Analytics
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAnalytics}
              className="ml-auto"
            >
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Performance metrics and delivery statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.summary.totalNotifications}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.summary.totalRead}
                  </div>
                  <div className="text-sm text-muted-foreground">Read</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics.summary.totalUnread}
                  </div>
                  <div className="text-sm text-muted-foreground">Unread</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.summary.overallReadRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">Read Rate</div>
                </div>
              </div>

              <Separator />

              {/* By Type */}
              <div>
                <h4 className="font-medium mb-3">By Notification Type</h4>
                <div className="space-y-2">
                  {analytics.byType.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{item.type}</Badge>
                        <Badge variant={item.priority === 'URGENT' ? 'destructive' : 'secondary'}>
                          {item.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span>Sent: {item.total_sent}</span>
                        <span>Read: {item.total_read}</span>
                        <span>Rate: {item.read_rate}%</span>
                        {item.avg_read_time_seconds && (
                          <span>Avg Time: {Math.round(item.avg_read_time_seconds)}s</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* By Delivery Method */}
              <div>
                <h4 className="font-medium mb-3">By Delivery Method</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.byDeliveryMethod.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{item.delivery_method}</Badge>
                        <Badge 
                          variant={
                            item.delivery_status === 'DELIVERED' ? 'default' :
                            item.delivery_status === 'SENT' ? 'secondary' :
                            item.delivery_status === 'FAILED' ? 'destructive' : 'outline'
                          }
                        >
                          {item.delivery_status}
                        </Badge>
                      </div>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
