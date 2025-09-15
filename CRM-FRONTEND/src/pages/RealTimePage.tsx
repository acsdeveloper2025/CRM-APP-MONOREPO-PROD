import React, { useState } from 'react';
import { Activity, Wifi, Bell, Users, MapPin, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RealTimeDashboard } from '@/components/realtime/RealTimeDashboard';
import { RealTimeCaseUpdates } from '@/components/realtime/RealTimeCaseUpdates';
import { ConnectionStatus } from '@/components/realtime/ConnectionStatus';
import { useWebSocket } from '@/hooks/useWebSocket';
import toast from 'react-hot-toast';

export function RealTimePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [testCaseId, setTestCaseId] = useState('');
  const [testMessage, setTestMessage] = useState('');

  const {
    isConnected,
    connectionStatus,
    subscribeToCase,
    unsubscribeFromCase,
    updateCaseStatus,
    sendTypingIndicator,
    updateLocation,
    notifications,
    unreadCount,
  } = useWebSocket({
    onNotification: (notification) => {
      toast(notification.title, {
        description: notification.message,
      });
    },
    onCaseUpdate: (update) => {
      toast('Case Updated', {
        description: `Case ${update.caseId} has been updated`,
      });
    },
    onCaseStatusUpdate: (update) => {
      toast('Status Changed', {
        description: `Case ${update.caseId} status changed to ${update.status}`,
      });
    },
  });

  const handleSubscribeToCase = () => {
    if (testCaseId.trim()) {
      subscribeToCase(testCaseId.trim());
      toast.success(`Subscribed to case ${testCaseId}`);
    }
  };

  const handleUnsubscribeFromCase = () => {
    if (testCaseId.trim()) {
      unsubscribeFromCase(testCaseId.trim());
      toast.success(`Unsubscribed from case ${testCaseId}`);
    }
  };

  const handleUpdateCaseStatus = () => {
    if (testCaseId.trim()) {
      updateCaseStatus(testCaseId.trim(), 'IN_PROGRESS');
      toast.success(`Updated case ${testCaseId} status`);
    }
  };

  const handleSendTyping = (isTyping: boolean) => {
    if (testCaseId.trim()) {
      sendTypingIndicator(testCaseId.trim(), isTyping);
    }
  };

  const handleUpdateLocation = () => {
    if (testCaseId.trim()) {
      // Simulate location update with random coordinates
      const lat = 28.6139 + (Math.random() - 0.5) * 0.1; // Delhi area
      const lng = 77.2090 + (Math.random() - 0.5) * 0.1;
      updateLocation(testCaseId.trim(), lat, lng);
      toast.success(`Updated location for case ${testCaseId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Real-time Features</h1>
          <p className="text-muted-foreground">
            Live updates, notifications, and real-time collaboration
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <ConnectionStatus showText size="lg" />
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </div>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="h-5 w-5" />
            <span>Connection Information</span>
          </CardTitle>
          <CardDescription>
            WebSocket connection status and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {connectionStatus.status}
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Latency</p>
              <p className="text-sm text-muted-foreground">
                {connectionStatus.latency ? `${connectionStatus.latency}ms` : 'N/A'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Reconnect Attempts</p>
              <p className="text-sm text-muted-foreground">
                {connectionStatus.reconnectAttempts || 0}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Notifications</p>
              <Badge variant="outline">
                {unreadCount} unread
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            <Activity className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="case-updates">
            <MessageSquare className="h-4 w-4 mr-2" />
            Case Updates
          </TabsTrigger>
          <TabsTrigger value="testing">
            <Users className="h-4 w-4 mr-2" />
            Testing Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <RealTimeDashboard />
        </TabsContent>

        <TabsContent value="case-updates" className="space-y-4">
          <RealTimeCaseUpdates />
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* WebSocket Testing */}
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Testing</CardTitle>
                <CardDescription>
                  Test real-time features and WebSocket events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Test Case ID</label>
                  <Input
                    placeholder="Enter case ID for testing"
                    value={testCaseId}
                    onChange={(e) => setTestCaseId(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Button
                    onClick={handleSubscribeToCase}
                    disabled={!isConnected || !testCaseId.trim()}
                    size="sm"
                  >
                    Subscribe to Case
                  </Button>
                  <Button
                    onClick={handleUnsubscribeFromCase}
                    disabled={!isConnected || !testCaseId.trim()}
                    variant="outline"
                    size="sm"
                  >
                    Unsubscribe from Case
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Button
                    onClick={handleUpdateCaseStatus}
                    disabled={!isConnected || !testCaseId.trim()}
                    variant="secondary"
                    size="sm"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Update Status
                  </Button>
                  <Button
                    onClick={handleUpdateLocation}
                    disabled={!isConnected || !testCaseId.trim()}
                    variant="secondary"
                    size="sm"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Update Location
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onMouseDown={() => handleSendTyping(true)}
                    onMouseUp={() => handleSendTyping(false)}
                    onMouseLeave={() => handleSendTyping(false)}
                    disabled={!isConnected || !testCaseId.trim()}
                    variant="outline"
                    size="sm"
                  >
                    Start Typing
                  </Button>
                  <Button
                    onClick={() => handleSendTyping(false)}
                    disabled={!isConnected || !testCaseId.trim()}
                    variant="outline"
                    size="sm"
                  >
                    Stop Typing
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Event Log */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Notifications</CardTitle>
                <CardDescription>
                  Latest real-time notifications and events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border ${
                          !notification.read ? 'bg-muted/50' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{notification.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {notification.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
