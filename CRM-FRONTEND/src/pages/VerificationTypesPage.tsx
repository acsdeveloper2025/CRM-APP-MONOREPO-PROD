import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { verificationTypesService } from '@/services/verificationTypes';
import { VerificationTypesTable } from '@/components/clients/VerificationTypesTable';
import { CreateVerificationTypeDialog } from '@/components/clients/CreateVerificationTypeDialog';

export function VerificationTypesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);

  // Fetch verification types data
  const { data: verificationTypesData, isLoading: verificationTypesLoading } = useQuery({
    queryKey: ['verification-types', searchQuery],
    queryFn: () => verificationTypesService.getVerificationTypes({ search: searchQuery }),
  });

  // Fetch verification types stats
  const { data: statsData } = useQuery({
    queryKey: ['verification-types-stats'],
    queryFn: () => verificationTypesService.getVerificationTypeStats(),
  });

  const verificationTypes = verificationTypesData?.data || [];
  const stats = statsData?.data || { total: 0, active: 0, inactive: 0, byCategory: {} };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verification Types Management</h1>
          <p className="text-muted-foreground">
            Manage verification types, categories, and configurations
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All verification types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Disabled or archived types
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification Types Console</CardTitle>
              <CardDescription>
                Create, edit, and manage verification types and configurations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Actions */}
            <div className="flex items-center justify-between">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search verification types..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCreateVerificationType(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Type
                </Button>
              </div>
            </div>

            {/* Verification Types Table */}
            <VerificationTypesTable
              data={verificationTypes}
              isLoading={verificationTypesLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateVerificationTypeDialog
        open={showCreateVerificationType}
        onOpenChange={setShowCreateVerificationType}
      />
    </div>
  );
}
