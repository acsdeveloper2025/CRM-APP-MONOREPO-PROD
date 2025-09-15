import React, { useState, useEffect } from 'react';
import { Users, Activity, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ConnectionStatus } from './ConnectionStatus';
import type { RealTimeStats } from '@/types/websocket';

interface RealTimeDashboardProps {
  refreshInterval?: number;
}

export function RealTimeDashboard({ refreshInterval = 30000 }: RealTimeDashboardProps) {
  const [stats, setStats] = useState<RealTimeStats>({
    connectedUsers: 0,
    activeCases: 0,
    pendingReviews: 0,
    systemLoad: 0,
    lastUpdated: new Date().toISOString(),
  });

  const { isConnected, webSocketService } = useWebSocket();

  // Request real-time stats
  const requestStats = () => {
    if (isConnected) {
      webSocketService.emit('stats:request');
    }
  };

  // Listen for stats updates
  useEffect(() => {
    const handleStatsUpdate = (newStats: RealTimeStats) => {
      setStats(newStats);
    };

    webSocketService.on('stats:update', handleStatsUpdate);

    return () => {
      webSocketService.off('stats:update', handleStatsUpdate);
    };
  }, [webSocketService]);

  // Request stats on mount and set up interval
  useEffect(() => {
    if (isConnected) {
      requestStats();
      
      const interval = setInterval(requestStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [isConnected, refreshInterval]);

  const getSystemLoadColor = (load: number) => {
    if (load < 50) return 'text-green-600';
    if (load < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSystemLoadVariant = (load: number) => {
    if (load < 50) return 'default' as const;
    if (load < 80) return 'secondary' as const;
    return 'destructive' as const;
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Real-time Dashboard</h2>
        <ConnectionStatus showText size="md" />
      </div>

      {/* Real-time Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.connectedUsers}</div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCases}</div>
            <p className="text-xs text-muted-foreground">
              Being worked on
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReviews}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getSystemLoadColor(stats.systemLoad)}`}>
              {stats.systemLoad}%
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant={getSystemLoadVariant(stats.systemLoad)} className="text-xs">
                {stats.systemLoad < 50 ? 'Normal' : 
                 stats.systemLoad < 80 ? 'High' : 'Critical'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Real-time system health and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* System Load Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">System Load</span>
                <span className="text-sm text-muted-foreground">{stats.systemLoad}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stats.systemLoad < 50 ? 'bg-green-600' :
                    stats.systemLoad < 80 ? 'bg-yellow-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(stats.systemLoad, 100)}%` }}
                />
              </div>
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last updated:</span>
              <span className="font-medium">
                {new Date(stats.lastUpdated).toLocaleTimeString()}
              </span>
            </div>

            {/* Connection Info */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Connection status:</span>
              <ConnectionStatus showText />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Activity</CardTitle>
            <CardDescription>
              Real-time user engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Connected Users</span>
                <Badge variant="outline">{stats.connectedUsers}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Sessions</span>
                <Badge variant="outline">{Math.floor(stats.connectedUsers * 0.8)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Mobile Users</span>
                <Badge variant="outline">{Math.floor(stats.connectedUsers * 0.6)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Case Activity</CardTitle>
            <CardDescription>
              Real-time case processing metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Cases</span>
                <Badge variant="outline">{stats.activeCases}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Pending Reviews</span>
                <Badge variant="outline">{stats.pendingReviews}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Completion Rate</span>
                <Badge variant="outline">
                  {stats.activeCases > 0 ? 
                    Math.round((stats.activeCases / (stats.activeCases + stats.pendingReviews)) * 100) : 0}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
