import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  className?: string;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = 'text-green-600',
  className,
  onClick,
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all duration-200',
        onClick && 'cursor-pointer hover:scale-105',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="text-sm sm:text-base font-medium truncate pr-2">{title}</CardTitle>
        <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5 shrink-0', color)} />
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="text-xl sm:text-2xl font-bold">{formatValue(value)}</div>
        {(description || trend) && (
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 mt-1">
            {trend && (
              <span
                className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
            {description && <span className="truncate">{description}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
