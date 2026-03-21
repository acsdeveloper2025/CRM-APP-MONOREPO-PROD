import { Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { TurnaroundTimeReport } from '@/types/reports';

interface TurnaroundTimeChartProps {
  data?: TurnaroundTimeReport;
}

export function TurnaroundTimeChart({ data }: TurnaroundTimeChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Stack direction="horizontal" gap={2} align="center">
              <Clock size={18} />
              <span>Turnaround Time Analysis</span>
            </Stack>
          </CardTitle>
          <CardDescription>Average case completion times and performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={2} align="center" style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Clock size={48} style={{ color: 'var(--ui-text-muted)' }} />
            <Text as="h3" variant="title">No data available</Text>
            <Text tone="muted">Turnaround time data will appear here once cases are completed.</Text>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const performanceTone = data.performancePercentage >= 80 ? 'positive' : data.performancePercentage >= 60 ? 'warning' : 'danger';
  const performanceIcon = data.performancePercentage >= data.targetTurnaroundTime
    ? <TrendingUp size={14} style={{ color: 'var(--ui-success)' }} />
    : <TrendingDown size={14} style={{ color: 'var(--ui-danger)' }} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Stack direction="horizontal" gap={2} align="center">
            <Clock size={18} />
            <span>Turnaround Time Analysis</span>
          </Stack>
        </CardTitle>
        <CardDescription>Average case completion times and performance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={6}>
          <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Text variant="headline">{data.averageTurnaroundTime}h</Text>
              <Text variant="caption" tone="muted">Average Time</Text>
            </Stack>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Text variant="headline">{data.targetTurnaroundTime}h</Text>
              <Text variant="caption" tone="muted">Target Time</Text>
            </Stack>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Stack direction="horizontal" gap={1} align="center">
                {performanceIcon}
                <Text variant="headline" tone={performanceTone}>{data.performancePercentage}%</Text>
              </Stack>
              <Text variant="caption" tone="muted">Performance</Text>
            </Stack>
          </Box>

          <Stack gap={3}>
            <Text as="h4" variant="label">Time Distribution</Text>
            <Stack gap={2}>
              {data.casesByTurnaroundTime.map((range, index) => (
                <Box key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <Text variant="body-sm">{range.range}</Text>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Box style={{ width: '8rem', height: '0.55rem', borderRadius: '999px', background: 'var(--ui-surface-muted)', overflow: 'hidden' }}>
                      <Box style={{ width: `${range.percentage}%`, height: '100%', borderRadius: '999px', background: 'var(--ui-accent)' }} />
                    </Box>
                    <Text variant="body-sm" style={{ minWidth: '2.5rem', textAlign: 'right' }}>{range.count}</Text>
                    <Badge variant="outline">{range.percentage}%</Badge>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Stack>

          <Stack gap={3}>
            <Text as="h4" variant="label">Top Performing Users</Text>
            <Stack gap={2}>
              {data.userWisePerformance.slice(0, 5).map((user, index) => (
                <Box
                  key={user.userId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    padding: '0.75rem',
                    borderRadius: 'var(--ui-radius-lg)',
                    background: 'var(--ui-surface-muted)',
                  }}
                >
                  <Stack direction="horizontal" gap={2} align="center">
                    <Box
                      style={{
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(17, 116, 110, 0.12)',
                        color: 'var(--ui-accent)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Text variant="body-sm">{user.userName}</Text>
                  </Stack>
                  <Stack gap={0} align="flex-end">
                    <Text variant="body-sm">{user.averageTurnaroundTime}h</Text>
                    <Text variant="caption" tone="muted">{user.caseCount} cases</Text>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
