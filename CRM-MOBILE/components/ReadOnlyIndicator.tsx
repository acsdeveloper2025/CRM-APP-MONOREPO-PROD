import React from 'react';
import { InfoIcon } from './Icons';
import { CaseStatus } from '../types';

interface ReadOnlyIndicatorProps {
  isReadOnly: boolean;
  caseStatus: CaseStatus;
  isSaved?: boolean;
}

const ReadOnlyIndicator: React.FC<ReadOnlyIndicatorProps> = ({ 
  isReadOnly, 
  caseStatus, 
  isSaved = false 
}) => {
  if (!isReadOnly) return null;

  return (
    <div className="flex items-center px-3 py-1 bg-gray-700 rounded-full border border-gray-600">
      <InfoIcon width={16} height={16} className="text-gray-400 mr-2" />
      <span className="text-xs text-gray-400 font-medium">
        {caseStatus === CaseStatus.Completed ? 'Case Submitted - Read Only' : 'Case Saved - Read Only'}
      </span>
    </div>
  );
};

export default ReadOnlyIndicator;
