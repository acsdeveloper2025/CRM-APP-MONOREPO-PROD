import React from 'react';
import { Case } from '../types';

interface CaseTimelineProps {
  caseData: Case;
  compact?: boolean;
}

interface TimelineEvent {
  label: string;
  timestamp: string | undefined;
  icon: string;
  color: string;
  description: string;
}

const CaseTimeline: React.FC<CaseTimelineProps> = ({ caseData, compact = false }) => {
  
  const formatTimestamp = (isoString?: string): string => {
    if (!isoString) return 'Not available';
    
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        label: 'Case Assigned',
        timestamp: caseData.createdAt,
        icon: '📋',
        color: 'text-blue-400',
        description: 'Case was initially assigned to you'
      },
      {
        label: 'In Progress',
        timestamp: caseData.inProgressAt || (caseData.status === 'In Progress' || caseData.status === 'IN_PROGRESS' ? caseData.updatedAt : undefined),
        icon: '🚀',
        color: 'text-yellow-400',
        description: 'Case moved to in-progress status'
      },
      {
        label: 'Last Updated',
        timestamp: caseData.savedAt || caseData.updatedAt,
        icon: '💾',
        color: 'text-purple-400',
        description: 'Case data was last updated'
      },
      {
        label: 'Completed',
        timestamp: caseData.completedAt,
        icon: '✅',
        color: 'text-green-400',
        description: 'Case was marked as complete'
      }
    ];

    // Filter out events that don't have timestamps (except for assigned which should always exist)
    return events.filter((event, index) => {
      if (index === 0) return true; // Always show assignment
      return event.timestamp; // Only show others if they have timestamps
    });
  };

  const timelineEvents = getTimelineEvents();

  if (compact) {
    // Compact view for case cards
    return (
      <div className="bg-gray-900/50 rounded-lg p-3 mt-3">
        <h4 className="text-xs font-semibold text-brand-primary mb-2 flex items-center gap-1">
          <span>⏱️</span>
          Case Timeline
        </h4>
        <div className="space-y-2">
          {timelineEvents.map((event, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-sm">{event.icon}</span>
                <span className="text-gray-300">{event.label}</span>
              </div>
              <span className={`${event.color} font-mono`}>
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full view for detailed timeline
  return (
    <div className="bg-gray-900/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-brand-primary mb-4 flex items-center gap-2">
        <span>⏱️</span>
        Case Progress Timeline
      </h3>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-600"></div>
        
        {timelineEvents.map((event, index) => {
          const hasTimestamp = event.timestamp && event.timestamp !== 'Not available';
          const isLast = index === timelineEvents.length - 1;
          
          return (
            <div key={index} className={`relative flex items-start gap-4 ${!isLast ? 'pb-6' : ''}`}>
              {/* Timeline dot */}
              <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                hasTimestamp 
                  ? 'bg-gray-800 border-gray-500' 
                  : 'bg-gray-900 border-gray-700'
              }`}>
                <span className="text-lg">{event.icon}</span>
              </div>
              
              {/* Event content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`font-semibold ${hasTimestamp ? event.color : 'text-gray-500'}`}>
                    {event.label}
                  </h4>
                  {hasTimestamp && (
                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  )}
                </div>
                
                <p className={`text-sm ${hasTimestamp ? 'text-gray-300' : 'text-gray-500'}`}>
                  {hasTimestamp ? event.description : 'This step was not completed'}
                </p>
                
                {!hasTimestamp && event.label !== 'Case Assigned' && (
                  <p className="text-xs text-gray-600 mt-1 italic">
                    No timestamp recorded for this event
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Summary section */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Total Duration:</span>
            <span className="ml-2 text-white font-mono">
              {calculateDuration(caseData.createdAt, caseData.completedAt)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Processing Time:</span>
            <span className="ml-2 text-white font-mono">
              {calculateDuration(caseData.inProgressAt, caseData.completedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const calculateDuration = (startTime?: string, endTime?: string): string => {
  if (!startTime || !endTime) return 'N/A';
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

export default CaseTimeline;
