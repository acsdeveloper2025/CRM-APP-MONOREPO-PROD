import { FileText, CheckCircle, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MISSummary } from '@/types/mis';

interface MISSummaryCardsProps {
  summary: MISSummary;
  isLoading?: boolean;
}

export function MISSummaryCards({ summary, isLoading }: MISSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // TASK-BASED SUMMARY CARDS
  const cards = [
    {
      title: 'Total Tasks',
      value: summary.total_tasks.toLocaleString(),
      subtitle: `${summary.completed_tasks} completed`,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: 'Total Amount',
      value: `₹${summary.total_actual_amount.toLocaleString()}`,
      subtitle: `Est: ₹${summary.total_estimated_amount.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Completion Rate',
      value: `${summary.task_completion_rate}%`,
      subtitle: `${summary.approved_tasks} approved`,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Avg TAT',
      value: `${summary.avg_tat_days.toFixed(1)} days`,
      subtitle: 'Turnaround time',
      icon: Clock,
      color: 'text-yellow-600 dark:text-orange-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    },
    {
      title: 'Rejected Tasks',
      value: summary.rejected_tasks.toLocaleString(),
      subtitle: `${((summary.rejected_tasks / summary.total_tasks) * 100).toFixed(1)}% rejection rate`,
      icon: TrendingUp,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-gray-600">
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

