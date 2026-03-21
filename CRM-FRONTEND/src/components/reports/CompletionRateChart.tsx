import { CheckCircle, Circle, Clock } from 'lucide-react';
import { Badge } from '@/ui/components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { CompletionRateReport } from '@/types/reports';

interface CompletionRateChartProps {
  data?: CompletionRateReport;
}

function ProgressRow({
  icon,
  label,
  count,
  percentage,
  fill,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  percentage: number;
  fill: string;
}) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <Stack direction="horizontal" gap={2} align="center">
        {icon}
        <Text variant="body-sm">{label}</Text>
      </Stack>
      <Stack direction="horizontal" gap={2} align="center">
        <Box style={{ width: '8rem', height: '0.55rem', borderRadius: '999px', background: 'var(--ui-surface-muted)', overflow: 'hidden' }}>
          <Box style={{ width: `${percentage}%`, height: '100%', borderRadius: '999px', background: fill }} />
        </Box>
        <Text variant="body-sm" style={{ minWidth: '2.5rem', textAlign: 'right' }}>{count}</Text>
      </Stack>
    </Box>
  );
}

export function CompletionRateChart({ data }: CompletionRateChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Stack direction="horizontal" gap={2} align="center">
              <CheckCircle size={18} />
              <span>Completion Rate Analysis</span>
            </Stack>
          </CardTitle>
          <CardDescription>Case completion rates and trends across different dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={2} align="center" style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={48} style={{ color: 'var(--ui-text-muted)' }} />
            <Text as="h3" variant="title">No data available</Text>
            <Text tone="muted">Completion rate data will appear here once cases are processed.</Text>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const completionTone = data.completionRate >= 80 ? 'positive' : data.completionRate >= 60 ? 'warning' : 'danger';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Stack direction="horizontal" gap={2} align="center">
            <CheckCircle size={18} />
            <span>Completion Rate Analysis</span>
          </Stack>
        </CardTitle>
        <CardDescription>Case completion rates and trends across different dimensions</CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={6}>
          <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Text variant="headline">{data.totalCases}</Text>
              <Text variant="caption" tone="muted">Total Cases</Text>
            </Stack>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Text variant="headline" tone="positive">{data.completedCases}</Text>
              <Text variant="caption" tone="muted">Completed</Text>
            </Stack>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Text variant="headline" tone="warning">{data.inProgressCases}</Text>
              <Text variant="caption" tone="muted">In Progress</Text>
            </Stack>
            <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
              <Text variant="headline" tone={completionTone}>{data.completionRate}%</Text>
              <Text variant="caption" tone="muted">Completion Rate</Text>
            </Stack>
          </Box>

          <Stack gap={3}>
            <Text as="h4" variant="label">Overall Progress</Text>
            <Stack gap={2}>
              <ProgressRow
                icon={<CheckCircle size={14} style={{ color: 'var(--ui-success)' }} />}
                label="Completed"
                count={data.completedCases}
                percentage={(data.completedCases / Math.max(data.totalCases, 1)) * 100}
                fill="var(--ui-success)"
              />
              <ProgressRow
                icon={<Clock size={14} style={{ color: 'var(--ui-warning)' }} />}
                label="In Progress"
                count={data.inProgressCases}
                percentage={(data.inProgressCases / Math.max(data.totalCases, 1)) * 100}
                fill="var(--ui-warning)"
              />
              <ProgressRow
                icon={<Circle size={14} style={{ color: 'var(--ui-text-muted)' }} />}
                label="Pending"
                count={data.pendingCases}
                percentage={(data.pendingCases / Math.max(data.totalCases, 1)) * 100}
                fill="var(--ui-text-muted)"
              />
            </Stack>
          </Stack>

          <Stack gap={3}>
            <Text as="h4" variant="label">Monthly Trends</Text>
            <Stack gap={2}>
              {data.monthlyTrends.slice(-6).map((trend) => (
                <Box
                  key={trend.month}
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
                  <Text variant="body-sm">{trend.month}</Text>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Text variant="body-sm">{trend.completedCases}/{trend.totalCases}</Text>
                    <Badge variant={trend.completionRate >= 80 ? 'positive' : trend.completionRate >= 60 ? 'warning' : 'danger'}>
                      {trend.completionRate}%
                    </Badge>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Stack>

          <Stack gap={3}>
            <Text as="h4" variant="label">Top Performing Clients</Text>
            <Stack gap={2}>
              {data.clientWiseCompletion
                .sort((a, b) => b.completionRate - a.completionRate)
                .slice(0, 5)
                .map((client, index) => (
                  <Box
                    key={client.clientId}
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
                      <Text variant="body-sm">{client.clientName}</Text>
                    </Stack>
                    <Stack gap={0} align="flex-end">
                      <Text variant="body-sm">{client.completionRate}%</Text>
                      <Text variant="caption" tone="muted">{client.completedCases}/{client.totalCases} cases</Text>
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
