import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import { CompletionRateReport } from '@/types/reports';

interface CompletionRateChartProps {
  data?: CompletionRateReport;
}

export function CompletionRateChart({ data }: CompletionRateChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Completion Rate Analysis</span>
          </CardTitle>
          <CardDescription>
            Case completion rates and trends across different dimensions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No data available</h3>
            <p className="text-muted-foreground">
              Completion rate data will appear here once cases are processed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionColor = data.completionRate >= 80 ? 'text-green-600' : 
                         data.completionRate >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5" />
          <span>Completion Rate Analysis</span>
        </CardTitle>
        <CardDescription>
          Case completion rates and trends across different dimensions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.totalCases}</div>
            <div className="text-sm text-muted-foreground">Total Cases</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.completedCases}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.inProgressCases}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${completionColor}`}>
              {data.completionRate}%
            </div>
            <div className="text-sm text-muted-foreground">Completion Rate</div>
          </div>
        </div>

        {/* Completion Rate Visualization */}
        <div>
          <h4 className="font-medium mb-3">Overall Progress</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Completed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${(data.completedCases / data.totalCases) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12">{data.completedCases}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm">In Progress</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(data.inProgressCases / data.totalCases) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12">{data.inProgressCases}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Circle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Pending</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-muted rounded-full h-2">
                  <div 
                    className="bg-muted-foreground h-2 rounded-full"
                    style={{ width: `${(data.pendingCases / data.totalCases) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12">{data.pendingCases}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trends */}
        <div>
          <h4 className="font-medium mb-3">Monthly Trends</h4>
          <div className="space-y-2">
            {data.monthlyTrends.slice(-6).map((trend, index) => (
              <div key={trend.month} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">{trend.month}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{trend.completedCases}/{trend.totalCases}</span>
                  <Badge 
                    variant={trend.completionRate >= 80 ? 'default' : trend.completionRate >= 60 ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {trend.completionRate}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Client Performance */}
        <div>
          <h4 className="font-medium mb-3">Top Performing Clients</h4>
          <div className="space-y-2">
            {data.clientWiseCompletion
              .sort((a, b) => b.completionRate - a.completionRate)
              .slice(0, 5)
              .map((client, index) => (
                <div key={client.clientId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium">{client.clientName}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{client.completionRate}%</div>
                    <div className="text-xs text-muted-foreground">
                      {client.completedCases}/{client.totalCases} cases
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
