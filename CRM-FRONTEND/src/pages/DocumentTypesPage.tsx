import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchWithActions } from '@/components/ui/search-layout';
import { useSearchInput } from '@/components/ui/search-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { documentTypesService } from '@/services/documentTypes';
import { DocumentTypesTable } from '@/components/document-types/DocumentTypesTable';
import { CreateDocumentTypeDialog } from '@/components/document-types/CreateDocumentTypeDialog';

export const DocumentTypesPage: React.FC = () => {
  const [showCreateDocumentType, setShowCreateDocumentType] = useState(false);

  // Use standardized search with debouncing
  const { debouncedSearchValue, setSearchValue } = useSearchInput('', 400);

  // Fetch document types
  const { data: documentTypesData, isLoading: documentTypesLoading } = useQuery({
    queryKey: ['document-types', { search: debouncedSearchValue }],
    queryFn: () => documentTypesService.getDocumentTypes({
      search: debouncedSearchValue,
      limit: 100,
      sortBy: 'sort_order',
      sortOrder: 'asc'
    }),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['document-types-stats'],
    queryFn: () => documentTypesService.getDocumentTypeStats(),
  });

  const documentTypes = documentTypesData?.data || [];
  const stats = statsData?.data || { total: 0, active: 0, inactive: 0, byCategory: {} };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Types Management</h1>
          <p className="text-muted-foreground">
            Manage document types, categories, and validation rules
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Document Types</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Types</CardTitle>
            <Badge variant="default" className="bg-green-500">Active</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Types</CardTitle>
            <Badge variant="secondary">Inactive</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.byCategory || {}).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Document Types</CardTitle>
          <CardDescription>
            Configure document types for verification processes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Standardized Search and Actions */}
            <SearchWithActions
              onSearch={setSearchValue}
              placeholder="Search document types..."
              isLoading={documentTypesLoading}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px]"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowCreateDocumentType(true)}
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document Type
                  </Button>
                </>
              }
            />

            {/* Document Types Table */}
            <DocumentTypesTable
              data={documentTypes}
              isLoading={documentTypesLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateDocumentTypeDialog
        open={showCreateDocumentType}
        onOpenChange={setShowCreateDocumentType}
      />
    </div>
  );
};
