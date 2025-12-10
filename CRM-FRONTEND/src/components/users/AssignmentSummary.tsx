import React from 'react';
import { MapPin, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PincodeAssignment } from '@/types/territoryAssignment';

interface AssignmentSummaryProps {
  savedAssignments: PincodeAssignment[];
  isLoading: boolean;
}

export const AssignmentSummary: React.FC<AssignmentSummaryProps> = ({
  savedAssignments,
  isLoading,
}) => {
  const totalPincodes = savedAssignments.length;
  const totalAreas = savedAssignments.reduce((sum, item) => sum + item.areaAssignments.length, 0);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (savedAssignments.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Assignments</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          This field agent has not been assigned to any territories yet. Use the Pincodes and Areas tabs
          to create new assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Read-Only View</p>
          <p className="text-blue-700">
            This tab shows the currently saved territory assignments for this field agent. To make changes,
            use the Pincodes and Areas tabs, then save your changes.
          </p>
        </div>
      </div>

      {/* Summary header */}
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Saved Territory Assignments</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {totalPincodes} {totalPincodes === 1 ? 'pincode' : 'pincodes'}
          </Badge>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            {totalAreas} {totalAreas === 1 ? 'area' : 'areas'}
          </Badge>
        </div>
      </div>

      {/* Saved assignments list */}
      <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
        {savedAssignments.map((assignment) => (
          <div key={assignment.assignmentId} className="p-4 bg-white">
            <div className="space-y-2">
              {/* Pincode info */}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-gray-900">{assignment.pincodeCode}</span>
                <span className="text-gray-500">-</span>
                <span className="text-gray-700">{assignment.cityName}</span>
                <span className="text-gray-400 text-sm">({assignment.stateName})</span>
              </div>

              {/* Areas */}
              {assignment.areaAssignments.length > 0 ? (
                <div className="pl-6">
                  <div className="text-sm text-gray-600 mb-1">
                    Areas ({assignment.areaAssignments.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {assignment.areaAssignments.map((area) => (
                      <Badge key={area.id} variant="outline" className="text-xs">
                        {area.areaName}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pl-6 text-sm text-gray-500 italic">No areas assigned</div>
              )}

              {/* Assignment date */}
              <div className="pl-6 text-xs text-gray-500">
                Assigned on: {new Date(assignment.assignedAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

