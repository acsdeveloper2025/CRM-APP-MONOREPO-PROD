import { BarChart3, CheckCircle, Clock, DollarSign, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from '@/ui/components/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { ReportSummary } from '@/types/reports';

interface ReportSummaryCardsProps {
  summaries: ReportSummary[];
}

const gridStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

const toneMap = {
  up: 'positive',
  down: 'danger',
  stable: 'muted',
} as const;

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
        return <TrendingUp size={12} style={{ color: 'var(--ui-success)' }} />;
      case 'down':
        return <TrendingDown size={12} style={{ color: 'var(--ui-danger)' }} />;
      case 'stable':
        return <Minus size={12} style={{ color: 'var(--ui-text-muted)' }} />;
      default:
        return null;
    }
  };

  if (!summaries || summaries.length === 0) {
    return (
      <Box style={gridStyle}>
        {[...Array(5)].map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <Stack direction="horizontal" gap={2} align="center">
                  <LoadingSpinner size="sm" />
                  <Text variant="label">Loading...</Text>
                </Stack>
                <BarChart3 size={16} style={{ color: 'var(--ui-text-muted)' }} />
              </Box>
            </CardHeader>
            <CardContent>
              <Stack gap={1}>
                <Text variant="headline">--</Text>
                <Text variant="caption" tone="muted">No data available</Text>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box style={gridStyle}>
      {summaries.map((summary) => {
        const Icon = getIcon(summary.reportType);
        const primaryMetric = summary.keyMetrics[0];
        const trendTone = toneMap[primaryMetric?.trend || 'stable'] || 'muted';

        return (
          <Card key={summary.reportType}>
            <CardHeader>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <CardTitle>{summary.title}</CardTitle>
                <Icon size={16} style={{ color: 'var(--ui-text-muted)' }} />
              </Box>
            </CardHeader>
            <CardContent>
              <Stack gap={2}>
                <Text variant="headline">{primaryMetric?.value || '--'}</Text>
                <Stack direction="horizontal" gap={1} align="center" wrap="wrap">
                  {primaryMetric?.trend ? getTrendIcon(primaryMetric.trend) : null}
                  <Text variant="caption" tone={trendTone}>
                    {primaryMetric?.trendPercentage !== undefined
                      ? `${primaryMetric.trendPercentage > 0 ? '+' : ''}${primaryMetric.trendPercentage}%`
                      : ''}
                  </Text>
                  <Text variant="caption" tone="muted">vs last period</Text>
                </Stack>
                <Text variant="caption" tone="muted">
                  Last updated: {new Date(summary.lastGenerated).toLocaleDateString()}
                </Text>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
