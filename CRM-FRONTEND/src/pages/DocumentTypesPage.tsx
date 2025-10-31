import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { documentTypesService } from '@/services/documentTypes';
import { DocumentTypesTable } from '@/components/document-types/DocumentTypesTable';
import { CreateDocumentTypeDialog } from '@/components/document-types/CreateDocumentTypeDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';

export const DocumentTypesPage: React.FC = () => {
  const [showCreateDocumentType, setShowCreateDocumentType] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Unified search with 800ms debounce
  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

  const { data: documentTypesData, isLoading: documentTypesLoading } = useQuery({
    queryKey: ['document-types', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => documentTypesService.getDocumentTypes({
      page: currentPage,
      limit: pageSize,
      sortBy: 'sort_order',
      sortOrder: 'asc',
      search: debouncedSearchValue || undefined,
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
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={() => setShowCreateDocumentType(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Document Type
              </Button>
            </div>

            {/* Document Types Table */}
            <DocumentTypesTable
              data={documentTypes}
              isLoading={documentTypesLoading}
            />

            {/* Pagination Controls */}
            {documentTypesData?.pagination && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {documentTypesData.data?.length || 0} of {documentTypesData.pagination.total} document types
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {documentTypesData.pagination.totalPages || 1}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= (documentTypesData.pagination.totalPages || 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
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
