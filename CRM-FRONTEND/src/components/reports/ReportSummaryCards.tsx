import React from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle, BarChart3, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportSummary } from '@/types/reports';
import { LoadingSpinner } from '@/components/ui/loading';

interface ReportSummaryCardsProps {
  summaries: ReportSummary[];
}

export function ReportSummaryCards({ summaries }: ReportSummaryCardsProps) {
  const getIcon = (reportType: string) => {
    switch (reportType) {
      case 'TURNAROUND_TIME':
        return Clock;
      case 'COMPLETION_RATE':
        return CheckCircle;
      case 'PRODUCTIVITY':
        return BarChart3;
      case 'FINANCIAL':
        return DollarSign;
      default:
        return BarChart3;
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      case 'stable':
        return <Minus className="h-3 w-3 text-gray-600" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  if (!summaries || summaries.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>Loading...</span>
                </div>
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-gray-600">
                No data available
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {summaries.map((summary) => {
        const Icon = getIcon(summary.reportType);
        const primaryMetric = summary.keyMetrics[0];
        
        return (
          <Card key={summary.reportType}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{summary.title}</CardTitle>
              <Icon className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {primaryMetric?.value || '--'}
              </div>
              <div className="flex items-center space-x-1 text-xs">
                {primaryMetric?.trend && getTrendIcon(primaryMetric.trend)}
                <span className={getTrendColor(primaryMetric?.trend)}>
                  {primaryMetric?.trendPercentage && (
                    `${primaryMetric.trendPercentage > 0 ? '+' : ''}${primaryMetric.trendPercentage}%`
                  )}
                </span>
                <span className="text-gray-600">
                  vs last period
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Last updated: {new Date(summary.lastGenerated).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
