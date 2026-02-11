import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  getStatusBadgeStyle, 
  getPriorityBadgeStyle, 
  getPriorityLabel, 
  getStatusLabel 
} from '@/lib/badgeStyles';
import { format } from 'date-fns';
import { MapPin, Phone, Building2, Clock, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Case } from '@/types/case';

interface CaseCardProps {
  case: Case;
  onClick?: () => void;
  className?: string;
}

/**
 * CaseCard component for displaying case information in a card layout.
 * Used primarily in virtualized lists and dashboards.
 */
export const CaseCard: React.FC<CaseCardProps> = ({ 
  case: caseItem, 
  onClick, 
  className 
}) => {
  const customerName = caseItem.customerName || caseItem.applicantName || 'N/A';
  const customerPhone = caseItem.customerPhone || caseItem.applicantPhone || 'N/A';
  const caseDisplayId = caseItem.caseId || caseItem.id?.slice(-8) || 'N/A';

  // Safely format the date
  const formatUpdateDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, hh:mm a');
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden cursor-pointer hover:border-green-500/50 transition-all duration-200 shadow-sm border-gray-200",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
              Case Reference
            </span>
            <span className="font-bold text-green-700 text-lg leading-tight">
              #{caseDisplayId}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={getStatusBadgeStyle(caseItem.status)}>
              {getStatusLabel(caseItem.status)}
            </Badge>
            <Badge className={getPriorityBadgeStyle(caseItem.priority)}>
              {getPriorityLabel(caseItem.priority)}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <div>
              <h3 className="font-bold text-gray-900 text-[15px] leading-snug">
                {customerName}
              </h3>
              <div className="flex items-center text-xs text-gray-600 mt-0.5">
                <Phone className="h-3 w-3 mr-1.5 shrink-0 text-gray-400" />
                {customerPhone}
              </div>
            </div>

            <div className="flex items-start text-xs text-gray-600">
              <MapPin className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0 text-gray-400" />
              <span className="line-clamp-2 leading-relaxed">{caseItem.address || 'No address provided'}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5 text-gray-400 shrink-0" />
              <div className="truncate">
                <span className="font-medium text-gray-500 mr-1">Client:</span>
                <span className="text-gray-900 font-semibold">{caseItem.clientName || caseItem.client?.name || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center text-xs">
              <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-gray-400 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-500">Tasks:</span>
                <span className="text-xs font-bold text-gray-900">{caseItem.totalTasks || 0}</span>
                <div className="flex items-center gap-1.5 text-[10px] font-bold ml-1">
                  <span className="text-green-600">✓ {caseItem.completedTasks || 0}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-yellow-600">⏳ {(caseItem.pendingTasks || 0) + (caseItem.inProgressTasks || 0)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center text-[10px] text-gray-400 pt-0.5">
              <Clock className="h-3 w-3 mr-1.5 shrink-0" />
              <span>Updated {formatUpdateDate(caseItem.updatedAt)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
