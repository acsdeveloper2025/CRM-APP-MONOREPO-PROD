import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  FileText,
  Download
} from 'lucide-react';
import { FieldUserAssignmentsTab } from '@/components/commission/FieldUserAssignmentsTab';

export const CommissionManagementPage: React.FC = () => {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">Commission Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage field employee commissions, rate assignments, and payments
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-2" />
            Documentation
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Commission Rate Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldUserAssignmentsTab />
        </CardContent>
      </Card>



      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Commission Management Guide</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• <strong>Rate Assignments:</strong> Assign commission rates to field users using existing rate types from the rate management system</p>
                <p>• <strong>Rate Selection:</strong> Choose from available rate types (Local, OGL, Outstation, etc.) when creating assignments</p>
                <p>• <strong>Auto-Calculation:</strong> Commissions are automatically calculated when field users complete cases</p>
                <p>• <strong>Commission Reports:</strong> View calculated commissions and payment tracking in Billing & Commission → Commissions</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
