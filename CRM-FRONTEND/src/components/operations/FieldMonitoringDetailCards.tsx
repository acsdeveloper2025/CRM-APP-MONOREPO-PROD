import React from 'react';
import { Badge } from '@/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import type { FieldMonitoringLiveStatus, FieldMonitoringUserDetail } from '@/services/fieldMonitoring';

interface FieldMonitoringDetailCardsProps {
  detail: FieldMonitoringUserDetail;
  formatTimestamp: (value: string | null | undefined) => string;
  getMobileDisplay: (user: {
    phone: string | null;
    employeeId: string | null;
    username: string;
  }) => string;
  statusBadgeClassNames: Record<FieldMonitoringLiveStatus, string>;
}

export const FieldMonitoringDetailCards = React.memo(function FieldMonitoringDetailCards({
  detail,
  formatTimestamp,
  getMobileDisplay,
  statusBadgeClassNames,
}: FieldMonitoringDetailCardsProps) {
  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{detail.user.name}</h2>
              <p className="text-sm text-gray-600">
                {getMobileDisplay({
                  phone: detail.user.phone,
                  employeeId: detail.user.employeeId,
                  username: detail.user.username,
                })}{' '}
                · {detail.user.email || detail.user.username}
              </p>
            </div>
            <Badge variant="outline" className={statusBadgeClassNames[detail.liveStatus]}>
              {detail.liveStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Known Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            <p>Latitude: {detail.lastKnownLocation?.lat ?? '-'}</p>
            <p>Longitude: {detail.lastKnownLocation?.lng ?? '-'}</p>
            <p>
              Recorded At: {formatTimestamp(detail.lastKnownLocation?.recordedAt || detail.activity.lastHeartbeatAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            <p>Last Heartbeat: {formatTimestamp(detail.activity.lastHeartbeatAt)}</p>
            <p>Last Task Activity: {formatTimestamp(detail.activity.lastTaskActivityAt)}</p>
            <p>Last Location: {formatTimestamp(detail.activity.lastLocationAt || detail.activity.lastHeartbeatAt)}</p>
            <p>Last Submission: {formatTimestamp(detail.activity.lastSubmissionAt)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operating Territory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            <p>Current Area: {detail.operatingTerritory.currentArea.name || '-'}</p>
            <p>Current Pincode: {detail.operatingTerritory.currentOperatingPincode || '-'}</p>
            <p>
              Assigned Areas:{' '}
              {detail.operatingTerritory.assignedTerritory.areas.length > 0
                ? detail.operatingTerritory.assignedTerritory.areas
                    .map((area) => `${area.areaName} (${area.pincodeCode})`)
                    .join(', ')
                : '-'}
            </p>
            <p>
              Assigned Pincodes:{' '}
              {detail.operatingTerritory.assignedTerritory.pincodes.length > 0
                ? detail.operatingTerritory.assignedTerritory.pincodes
                    .map((pincode) => pincode.pincodeCode)
                    .join(', ')
                : '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.openAssignments.length === 0 ? (
              <p className="text-sm text-gray-600">No open assignments.</p>
            ) : (
              <div className="space-y-3">
                {detail.openAssignments.map((assignment) => (
                  <div key={assignment.task.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Task {assignment.task.taskNumber}</p>
                        <p className="text-sm text-gray-600">
                          Case #{assignment.case.caseNumber} · {assignment.case.customerName}
                        </p>
                      </div>
                      <Badge variant="outline">{assignment.task.status}</Badge>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                      <p>Priority: {assignment.task.priority || '-'}</p>
                      <p>Pincode: {assignment.task.pincode || '-'}</p>
                      <p>Assigned At: {formatTimestamp(assignment.task.assignedAt)}</p>
                      <p>Started At: {formatTimestamp(assignment.task.startedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
});
