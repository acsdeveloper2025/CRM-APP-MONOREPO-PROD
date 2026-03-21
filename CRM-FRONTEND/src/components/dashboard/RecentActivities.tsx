import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { Badge } from '@/ui/components/badge';
import { format } from 'date-fns';
import { FileText, CheckSquare, Receipt, UserCheck } from 'lucide-react';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
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
export const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities, isLoading }) => {
    if (isLoading) {
        return (<Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Latest updates and actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div {...{ className: "space-y-4" }}>
            {[1, 2, 3, 4, 5].map((item) => (<div key={item} {...{ className: "flex items-center space-x-4 animate-pulse" }}>
                <div {...{ className: "w-8 h-8 bg-slate-100 dark:bg-slate-800/60 rounded-full" }}/>
                <div {...{ className: "flex-1 space-y-2" }}>
                  <div {...{ className: "h-4 bg-slate-100 dark:bg-slate-800/60 rounded w-3/4" }}/>
                  <div {...{ className: "h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" }}/>
                </div>
              </div>))}
          </div>
        </CardContent>
      </Card>);
    }
    return (<Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
        <CardDescription>Latest updates and actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div {...{ className: "space-y-4" }}>
          {activities.length === 0 ? (<p {...{ className: "text-sm text-gray-600 text-center py-4" }}>
              No recent activities
            </p>) : (activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            return (<div key={activity.id} {...{ className: "flex items-start space-x-4" }}>
                  <div {...{ className: "shrink-0" }}>
                    <div {...{ className: "w-8 h-8 bg-slate-100 dark:bg-slate-800/60 rounded-full flex items-center justify-center" }}>
                      <Icon {...{ className: "w-4 h-4 text-gray-600" }}/>
                    </div>
                  </div>
                  <div {...{ className: "flex-1 min-w-0" }}>
                    <div {...{ className: "flex items-center space-x-2" }}>
                      <p {...{ className: "text-sm font-medium text-gray-600" }}>
                        {activity.title}
                      </p>
                      <Badge {...{ className: baseBadgeStyle }}>
                        {formatBadgeLabel(activity.type)}
                      </Badge>
                    </div>
                    <p {...{ className: "text-sm text-gray-600 mt-1" }}>
                      {activity.description}
                    </p>
                    <div {...{ className: "flex items-center space-x-2 mt-1" }}>
                      {activity.userName && (<span {...{ className: "text-xs text-gray-600" }}>
                          by {activity.userName}
                        </span>)}
                      <span {...{ className: "text-xs text-gray-600" }}>
                        {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>);
        }))}
        </div>
      </CardContent>
    </Card>);
};
