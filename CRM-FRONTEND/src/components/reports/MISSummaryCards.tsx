import { CheckCircle, Clock, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import type { MISSummary } from '@/types/mis';

interface MISSummaryCardsProps {
  summary: MISSummary;
  isLoading?: boolean;
}

const gridStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

export function MISSummaryCards({ summary, isLoading }: MISSummaryCardsProps) {
  if (isLoading) {
    return (
      <Box style={gridStyle}>
        {[1, 2, 3, 4, 5].map((item) => (
          <Card key={item}>
            <CardContent>
              <Stack gap={2}>
                <Box
                  style={{
                    height: '0.85rem',
                    width: '45%',
                    borderRadius: '999px',
                    background: 'var(--ui-surface-muted)',
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}
                />
                <Box
                  style={{
                    height: '2rem',
                    width: '75%',
                    borderRadius: '0.75rem',
                    background: 'var(--ui-surface-muted)',
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const safeSummary = {
    total_tasks: num(summary?.total_tasks),
    total_estimated_amount: num(summary?.total_estimated_amount),
    total_actual_amount: num(summary?.total_actual_amount),
    completed_tasks: num(summary?.completed_tasks),
    task_completion_rate: num(summary?.task_completion_rate),
    avg_tat_days: num(summary?.avg_tat_days),
  };
  const openTasks = Math.max(safeSummary.total_tasks - safeSummary.completed_tasks, 0);

  const cards = [
    {
      title: 'Total Tasks',
      value: safeSummary.total_tasks.toLocaleString(),
      subtitle: `${safeSummary.completed_tasks} completed`,
      icon: FileText,
      tint: 'rgba(39, 118, 255, 0.12)',
      color: '#2776ff',
    },
    {
      title: 'Total Amount',
      value: `₹${safeSummary.total_actual_amount.toLocaleString()}`,
      subtitle: `Est: ₹${safeSummary.total_estimated_amount.toLocaleString()}`,
      icon: DollarSign,
      tint: 'rgba(6, 166, 95, 0.12)',
      color: '#06a65f',
    },
    {
      title: 'Completion Rate',
      value: `${safeSummary.task_completion_rate}%`,
      subtitle: `${safeSummary.completed_tasks} completed`,
      icon: CheckCircle,
      tint: 'rgba(6, 166, 95, 0.12)',
      color: '#06a65f',
    },
    {
      title: 'Avg TAT',
      value: `${safeSummary.avg_tat_days.toFixed(1)} days`,
      subtitle: 'Turnaround time',
      icon: Clock,
      tint: 'rgba(217, 119, 6, 0.12)',
      color: '#d97706',
    },
    {
      title: 'Open Tasks',
      value: openTasks.toLocaleString(),
      subtitle: `${((openTasks / Math.max(safeSummary.total_tasks, 1)) * 100).toFixed(1)}% of total`,
      icon: TrendingUp,
      tint: 'rgba(220, 38, 38, 0.12)',
      color: '#dc2626',
    },
  ];

  return (
    <Box style={gridStyle}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader>
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <CardTitle>{card.title}</CardTitle>
                <Box
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: card.tint,
                    color: card.color,
                  }}
                >
                  <Icon size={16} />
                </Box>
              </Box>
            </CardHeader>
            <CardContent>
              <Stack gap={1}>
                <Text variant="headline">{card.value}</Text>
                <Text variant="caption" tone="muted">{card.subtitle}</Text>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
