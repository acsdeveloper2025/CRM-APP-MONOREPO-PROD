import React from 'react';
import { X, Save, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AssignmentSummaryItem } from '@/types/territoryAssignment';

interface AssignmentSummaryProps {
  summaryItems: AssignmentSummaryItem[];
  onRemove: (pincodeId: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const AssignmentSummary: React.FC<AssignmentSummaryProps> = ({
  summaryItems,
  onRemove,
  onSave,
  isSaving,
}) => {
  const totalPincodes = summaryItems.length;
  const totalAreas = summaryItems.reduce((sum, item) => sum + item.areaIds.length, 0);

  if (summaryItems.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments Yet</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          Select pincodes and areas from the tabs above. Your selections will appear here as a summary
          before saving.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Assignment Summary</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {totalPincodes} {totalPincodes === 1 ? 'pincode' : 'pincodes'}
            </Badge>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
              {totalAreas} {totalAreas === 1 ? 'area' : 'areas'}
            </Badge>
          </div>
        </div>

        <Button onClick={onSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save All Assignments'}
        </Button>
      </div>

      {/* Summary list */}
      <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
        {summaryItems.map((item) => (
          <div key={item.pincodeId} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                {/* Pincode info */}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-gray-900">{item.pincodeCode}</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-gray-700">{item.cityName}</span>
                </div>

                {/* Areas */}
                {item.areaIds.length > 0 ? (
                  <div className="pl-6">
                    <div className="text-sm text-gray-600 mb-1">
                      Areas ({item.areaIds.length}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.areaNames.map((areaName, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {areaName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pl-6 text-sm text-gray-500 italic">No areas selected</div>
                )}
              </div>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.pincodeId)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Save button at bottom */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={onSave}
          disabled={isSaving}
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Save className="h-5 w-5 mr-2" />
          {isSaving ? 'Saving Assignments...' : `Save ${totalPincodes} Pincode${totalPincodes !== 1 ? 's' : ''} & ${totalAreas} Area${totalAreas !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
};

