import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { TurnaroundTimeReport } from '@/types/reports';

interface TurnaroundTimeChartProps {
  data?: TurnaroundTimeReport;
}

export function TurnaroundTimeChart({ data }: TurnaroundTimeChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Turnaround Time Analysis</span>
          </CardTitle>
          <CardDescription>
            Average case completion times and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No data available</h3>
            <p className="text-muted-foreground">
              Turnaround time data will appear here once cases are completed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const performanceColor = data.performancePercentage >= 80 ? 'text-green-600' : 
                          data.performancePercentage >= 60 ? 'text-yellow-600' : 'text-red-600';

  const performanceIcon = data.performancePercentage >= data.targetTurnaroundTime ? 
                         <TrendingUp className="h-4 w-4 text-green-600" /> : 
                         <TrendingDown className="h-4 w-4 text-red-600" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Turnaround Time Analysis</span>
        </CardTitle>
        <CardDescription>
          Average case completion times and performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.averageTurnaroundTime}h</div>
            <div className="text-sm text-muted-foreground">Average Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{data.targetTurnaroundTime}h</div>
            <div className="text-sm text-muted-foreground">Target Time</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold flex items-center justify-center space-x-1 ${performanceColor}`}>
              {performanceIcon}
              <span>{data.performancePercentage}%</span>
            </div>
            <div className="text-sm text-muted-foreground">Performance</div>
          </div>
        </div>

        {/* Turnaround Time Distribution */}
        <div>
          <h4 className="font-medium mb-3">Time Distribution</h4>
          <div className="space-y-2">
            {data.casesByTurnaroundTime.map((range, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{range.range}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${range.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12">{range.count}</span>
                  <Badge variant="outline" className="text-xs">
                    {range.percentage}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers */}
        <div>
          <h4 className="font-medium mb-3">Top Performing Users</h4>
          <div className="space-y-2">
            {data.userWisePerformance.slice(0, 5).map((user, index) => (
              <div key={user.userId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium">{user.userName}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{user.averageTurnaroundTime}h</div>
                  <div className="text-xs text-muted-foreground">{user.caseCount} cases</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
