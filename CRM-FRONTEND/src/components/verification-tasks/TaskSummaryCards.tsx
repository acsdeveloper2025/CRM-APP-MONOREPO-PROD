import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  Clock,
  TrendingUp,
  Play
} from 'lucide-react';

interface TaskSummaryCardsProps {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  pendingCount: number;
  assignedCount: number;
  inProgressCount: number;
}

export const TaskSummaryCards: React.FC<TaskSummaryCardsProps> = ({
  totalTasks,
  completedTasks,
  completionPercentage,
  pendingCount,
  assignedCount,
  inProgressCount
}) => {
  const summaryCards = [
    {
      title: 'Total Tasks',
      value: totalTasks,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'All verification tasks'
    },
    {
      title: 'Completed',
      value: completedTasks,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: `${completionPercentage.toFixed(1)}% completion rate`
    },
    {
      title: 'In Progress',
      value: inProgressCount,
      icon: Play,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Currently being worked on'
    },
    {
      title: 'Pending',
      value: pendingCount + assignedCount,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Awaiting action'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {summaryCards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {card.description}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Progress Card */}
      {totalTasks > 0 && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Overall Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {completedTasks} of {totalTasks} tasks completed
                </span>
                <span className="font-medium text-gray-900">
                  {completionPercentage.toFixed(1)}%
                </span>
              </div>
              
              <Progress 
                value={completionPercentage} 
                className="h-3"
              />
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                  <span className="text-gray-600">
                    Pending: {pendingCount}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full" />
                  <span className="text-gray-600">
                    Assigned: {assignedCount}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-400 rounded-full" />
                  <span className="text-gray-600">
                    In Progress: {inProgressCount}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
