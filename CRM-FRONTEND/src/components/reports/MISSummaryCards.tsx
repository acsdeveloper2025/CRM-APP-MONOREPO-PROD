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
                <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
                <div className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

  const safeSummary = {
    totalTasks: num(summary?.totalTasks),
    totalEstimatedAmount: num(summary?.totalEstimatedAmount),
    totalActualAmount: num(summary?.totalActualAmount),
    completedTasks: num(summary?.completedTasks),
    taskCompletionRate: num(summary?.taskCompletionRate),
    avgTatDays: num(summary?.avgTatDays),
  };
  const openTasks = Math.max(safeSummary.totalTasks - safeSummary.completedTasks, 0);

  // TASK-BASED SUMMARY CARDS
  const cards = [
    {
      title: 'Total Tasks',
      value: safeSummary.totalTasks.toLocaleString(),
      subtitle: `${safeSummary.completedTasks} completed`,
      icon: FileText,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: 'Total Amount',
      value: `₹${safeSummary.totalActualAmount.toLocaleString()}`,
      subtitle: `Est: ₹${safeSummary.totalEstimatedAmount.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Completion Rate',
      value: `${safeSummary.taskCompletionRate}%`,
      subtitle: `${safeSummary.completedTasks} completed`,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Avg TAT',
      value: `${safeSummary.avgTatDays.toFixed(1)} days`,
      subtitle: 'Turnaround time',
      icon: Clock,
      color: 'text-yellow-600 dark:text-orange-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    },
    {
      title: 'Open Tasks',
      value: openTasks.toLocaleString(),
      subtitle: `${((openTasks / Math.max(safeSummary.totalTasks, 1)) * 100).toFixed(1)}% of total`,
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
