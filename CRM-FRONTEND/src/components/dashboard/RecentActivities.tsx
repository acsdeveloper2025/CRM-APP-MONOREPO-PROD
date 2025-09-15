import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { FileText, CheckSquare, Receipt, UserCheck } from 'lucide-react';

interface RecentActivity {
  id: string;
  type: 'caseAssigned' | 'caseCompleted' | 'caseApproved' | 'invoiceGenerated';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  caseId?: string;
  clientId?: string;
}

interface RecentActivitiesProps {
  activities: RecentActivity[];
  isLoading?: boolean;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'caseAssigned':
      return FileText;
    case 'caseCompleted':
      return CheckSquare;
    case 'caseApproved':
      return UserCheck;
    case 'invoiceGenerated':
      return Receipt;
    default:
      return FileText;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'caseAssigned':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'caseCompleted':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'caseApproved':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
    case 'invoiceGenerated':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Latest updates and actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center space-x-4 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>Latest updates and actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activities
            </p>
          ) : (
            activities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-foreground">
                        {activity.title}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={getActivityColor(activity.type)}
                      >
                        {activity.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {activity.userName && (
                        <span className="text-xs text-muted-foreground">
                          by {activity.userName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
