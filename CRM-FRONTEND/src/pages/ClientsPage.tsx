import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientsService } from '@/services/clients';
import { documentTypesService } from '@/services/documentTypes';
import { dashboardService } from '@/services/dashboard';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { ProductsTable } from '@/components/clients/ProductsTable';
import { VerificationTypesTable } from '@/components/clients/VerificationTypesTable';
import { DocumentTypesTable } from '@/components/document-types/DocumentTypesTable';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { CreateProductDialog } from '@/components/clients/CreateProductDialog';
import { CreateVerificationTypeDialog } from '@/components/clients/CreateVerificationTypeDialog';
import { CreateDocumentTypeDialog } from '@/components/document-types/CreateDocumentTypeDialog';
import { BulkImportDialog } from '@/components/clients/BulkImportDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchFilterLayout } from '@/components/ui/unified-search-filter-layout';

export function ClientsPage() {
  const [activeTab, setActiveTab] = useState('clients');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);
  const [showCreateDocumentType, setShowCreateDocumentType] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<'clients' | 'products'>('clients');

  // Pagination state for each tab
  const [clientsPage, setClientsPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [verificationTypesPage, setVerificationTypesPage] = useState(1);
  const [documentTypesPage, setDocumentTypesPage] = useState(1);
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

  // Reset pagination to page 1 when search changes for all tabs
  useEffect(() => {
    setClientsPage(1);
    setProductsPage(1);
    setVerificationTypesPage(1);
    setDocumentTypesPage(1);
  }, [debouncedSearchValue]);

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', debouncedSearchValue, clientsPage, pageSize],
    queryFn: () => clientsService.getClients({
      search: debouncedSearchValue || undefined,
      page: clientsPage,
      limit: pageSize,
    }),
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', debouncedSearchValue, productsPage, pageSize],
    queryFn: () => clientsService.getProducts({
      search: debouncedSearchValue || undefined,
      page: productsPage,
      limit: pageSize,
    }),
  });

  const { data: verificationTypesData, isLoading: verificationTypesLoading } = useQuery({
    queryKey: ['verification-types', debouncedSearchValue, verificationTypesPage, pageSize],
    queryFn: () => clientsService.getVerificationTypes({
      search: debouncedSearchValue || undefined,
      page: verificationTypesPage,
      limit: pageSize,
    }),
  });

  const { data: documentTypesData, isLoading: documentTypesLoading } = useQuery({
    queryKey: ['document-types', debouncedSearchValue, documentTypesPage, pageSize],
    queryFn: () => documentTypesService.getDocumentTypes({
      search: debouncedSearchValue || undefined,
      page: documentTypesPage,
      limit: pageSize,
    }),
  });

  const { data: dashboardStatsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getDashboardStats(),
  });

  const handleBulkImport = (type: 'clients' | 'products') => {
    setBulkImportType(type);
    setShowBulkImport(true);
  };

  const getTabStats = () => {
    const statsData = dashboardStatsData?.data;
    return {
      clients: clientsData?.pagination?.total || clientsData?.data?.length || 0,
      products: productsData?.pagination?.total || productsData?.data?.length || 0,
      verificationTypes: verificationTypesData?.pagination?.total || verificationTypesData?.data?.length || 0,
      documentTypes: documentTypesData?.pagination?.total || documentTypesData?.data?.length || 0,
      activeCases: (statsData?.inProgressCases || 0) + (statsData?.pendingCases || 0),
    };
  };

  const stats = getTabStats();

  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Client & Product Management</h1>
          <p className="text-gray-600">
            Manage clients, products, verification types, and their relationships
          </p>
        </div>
      </div>

      {/* Stats Cards - Following responsive grid pattern */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clients}</div>
            <p className="text-xs text-gray-600">
              Active organizations
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.products}</div>
            <p className="text-xs text-gray-600">
              All products
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verificationTypes}</div>
            <p className="text-xs text-gray-600">
              Available types
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documentTypes}</div>
            <p className="text-xs text-gray-600">
              Document types
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCases || 0}</div>
            <p className="text-xs text-gray-600">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Management Console</CardTitle>
              <CardDescription>
                Create, edit, and manage clients, products, and verification types
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:grid-cols-4 min-w-max">
                  <TabsTrigger value="clients" className="text-xs sm:text-sm whitespace-nowrap">
                    <span className="hidden sm:inline">Clients</span>
                    <span className="sm:hidden">Clients</span>
                    {stats.clients > 0 && (
                      <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                        {stats.clients}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="products" className="text-xs sm:text-sm whitespace-nowrap">
                    <span className="hidden sm:inline">Products</span>
                    <span className="sm:hidden">Products</span>
                    {stats.products > 0 && (
                      <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                        {stats.products}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="verification-types" className="text-xs sm:text-sm whitespace-nowrap">
                    <span className="hidden sm:inline">Verification Types</span>
                    <span className="sm:hidden">Verify</span>
                    {stats.verificationTypes > 0 && (
                      <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                        {stats.verificationTypes}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="document-types" className="text-xs sm:text-sm whitespace-nowrap">
                    <span className="hidden sm:inline">Document Types</span>
                    <span className="sm:hidden">Docs</span>
                    {stats.documentTypes > 0 && (
                      <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                        {stats.documentTypes}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

              <div className="flex flex-wrap gap-2">
                {/* Actions handled by UnifiedSearchFilterLayout within tabs */}
              </div>
            </div>

            {/* Tab Content - Responsive with overflow handling */}
            <TabsContent value="clients" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                onSearchClear={clearSearch}
                isSearchLoading={isDebouncing}
                searchPlaceholder="Search clients by name, email or code..."
                showFilters={false}
                actions={
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('clients')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateClient(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Client
                    </Button>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <div className="min-w-[800px] lg:min-w-0">
                  <ClientsTable
                    data={clientsData?.data || []}
                    isLoading={clientsLoading}
                  />
                </div>
                {/* Pagination Controls */}
                {clientsData?.pagination && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {clientsData.data?.length || 0} of {clientsData.pagination.total} clients
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClientsPage(prev => Math.max(1, prev - 1))}
                        disabled={clientsPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {clientsPage} of {clientsData.pagination.totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClientsPage(prev => prev + 1)}
                        disabled={clientsPage >= (clientsData.pagination.totalPages || 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                onSearchClear={clearSearch}
                isSearchLoading={isDebouncing}
                searchPlaceholder="Search products by name, code or category..."
                showFilters={false}
                actions={
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('products')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateProduct(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <div className="min-w-[800px] lg:min-w-0">
                  <ProductsTable
                    data={productsData?.data || []}
                    isLoading={productsLoading}
                  />
                </div>
                {/* Pagination Controls */}
                {productsData?.pagination && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {productsData.data?.length || 0} of {productsData.pagination.total} products
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductsPage(prev => Math.max(1, prev - 1))}
                        disabled={productsPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {productsPage} of {productsData.pagination.totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProductsPage(prev => prev + 1)}
                        disabled={productsPage >= (productsData.pagination.totalPages || 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="verification-types" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                onSearchClear={clearSearch}
                isSearchLoading={isDebouncing}
                searchPlaceholder="Search verification types by name, code or category..."
                showFilters={false}
                actions={
                  <Button
                    size="sm"
                    onClick={() => setShowCreateVerificationType(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Type
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <div className="min-w-[600px] lg:min-w-0">
                  <VerificationTypesTable
                    data={verificationTypesData?.data || []}
                    isLoading={verificationTypesLoading}
                  />
                </div>
                {/* Pagination Controls */}
                {verificationTypesData?.pagination && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {verificationTypesData.data?.length || 0} of {verificationTypesData.pagination.total} verification types
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVerificationTypesPage(prev => Math.max(1, prev - 1))}
                        disabled={verificationTypesPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {verificationTypesPage} of {verificationTypesData.pagination.totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVerificationTypesPage(prev => prev + 1)}
                        disabled={verificationTypesPage >= (verificationTypesData.pagination.totalPages || 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="document-types" className="space-y-4">
              <UnifiedSearchFilterLayout
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                onSearchClear={clearSearch}
                isSearchLoading={isDebouncing}
                searchPlaceholder="Search document types by name, code or category..."
                showFilters={false}
                actions={
                  <Button
                    size="sm"
                    onClick={() => setShowCreateDocumentType(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document Type
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <div className="min-w-[700px] lg:min-w-0">
                  <DocumentTypesTable
                    data={documentTypesData?.data || []}
                    isLoading={documentTypesLoading}
                  />
                </div>
                {/* Pagination Controls */}
                {documentTypesData?.pagination && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {documentTypesData.data?.length || 0} of {documentTypesData.pagination.total} document types
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDocumentTypesPage(prev => Math.max(1, prev - 1))}
                        disabled={documentTypesPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {documentTypesPage} of {documentTypesData.pagination.totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDocumentTypesPage(prev => prev + 1)}
                        disabled={documentTypesPage >= (documentTypesData.pagination.totalPages || 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateClientDialog
        open={showCreateClient}
        onOpenChange={setShowCreateClient}
      />
      
      <CreateProductDialog
        open={showCreateProduct}
        onOpenChange={setShowCreateProduct}
      />
      
      <CreateVerificationTypeDialog
        open={showCreateVerificationType}
        onOpenChange={setShowCreateVerificationType}
      />

      <CreateDocumentTypeDialog
        open={showCreateDocumentType}
        onOpenChange={setShowCreateDocumentType}
      />
      
      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        type={bulkImportType}
      />
    </div>
  );
}
