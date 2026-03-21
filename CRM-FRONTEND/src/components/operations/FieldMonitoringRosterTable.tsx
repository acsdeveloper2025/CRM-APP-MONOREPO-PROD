import React from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/ui/components/table';
import type { FieldMonitoringLiveStatus, FieldMonitoringRosterItem } from '@/services/fieldMonitoring';
interface FieldMonitoringRosterTableProps {
    roster: FieldMonitoringRosterItem[];
    onView: (userId: string) => void;
    formatTimestamp: (value: string | null | undefined) => string;
    getLastLocationDisplayTime: (user: Pick<FieldMonitoringRosterItem, 'lastLocation' | 'lastHeartbeatAt'>) => string;
    getMobileDisplay: (user: Pick<FieldMonitoringRosterItem, 'phone' | 'employeeId' | 'username'>) => string;
    statusBadgeClassNames: Record<FieldMonitoringLiveStatus, string>;
}
export const FieldMonitoringRosterTable = React.memo(function FieldMonitoringRosterTable({ roster, onView, formatTimestamp, getLastLocationDisplayTime, getMobileDisplay, statusBadgeClassNames, }: FieldMonitoringRosterTableProps) {
    return (<div {...{ className: "rounded-lg border border-gray-200" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Live Status</TableHead>
            <TableHead>Operating Area</TableHead>
            <TableHead>Operating Pincode</TableHead>
            <TableHead>Last Activity Time</TableHead>
            <TableHead>Last Location Time</TableHead>
            <TableHead>Active Assignments</TableHead>
            <TableHead {...{ className: "text-right" }}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((user) => (<TableRow key={user.id}>
              <TableCell>
                <div {...{ className: "space-y-1" }}>
                  <div {...{ className: "font-medium" }}>{user.name}</div>
                  {user.currentCaseSummary ? (<div {...{ className: "text-xs text-gray-500" }}>
                      Case #{user.currentCaseSummary.caseNumber} · {user.currentCaseSummary.customerName}
                    </div>) : null}
                </div>
              </TableCell>
              <TableCell>{getMobileDisplay(user)}</TableCell>
              <TableCell>
                <Badge variant="outline" {...{ className: statusBadgeClassNames[user.liveStatus] }}>
                  {user.liveStatus}
                </Badge>
              </TableCell>
              <TableCell>{user.operatingArea || '-'}</TableCell>
              <TableCell>{user.operatingPincode || '-'}</TableCell>
              <TableCell>{formatTimestamp(user.lastActivityAt)}</TableCell>
              <TableCell>{getLastLocationDisplayTime(user)}</TableCell>
              <TableCell>{user.activeAssignmentCount}</TableCell>
              <TableCell {...{ className: "text-right" }}>
                <Button variant="outline" size="sm" {...{ className: "gap-2" }} onClick={() => onView(user.id)}>
                  <Eye {...{ className: "h-4 w-4" }}/>
                  View
                </Button>
              </TableCell>
            </TableRow>))}
        </TableBody>
      </Table>
    </div>);
});
