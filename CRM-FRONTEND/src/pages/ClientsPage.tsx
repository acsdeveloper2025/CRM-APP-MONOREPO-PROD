import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { ClientManagementSummaryCards } from '@/components/clients/ClientManagementSummaryCards';
import { ClientManagementTabPanel } from '@/components/clients/ClientManagementTabPanel';
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
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

type ClientManagementTab = 'clients' | 'products' | 'verification-types' | 'document-types';

export function ClientsPage() {
  const [activeTab, setActiveTab] = useState<ClientManagementTab>('clients');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);
  const [showCreateDocumentType, setShowCreateDocumentType] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<'clients' | 'products'>('clients');

  const [clientsPage, setClientsPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [verificationTypesPage, setVerificationTypesPage] = useState(1);
  const [documentTypesPage, setDocumentTypesPage] = useState(1);
  const pageSize = 20;

  const {
    searchValue,
    debouncedSearchValue,
    setSearchValue,
    clearSearch,
    isDebouncing,
  } = useUnifiedSearch({
    syncWithUrl: true,
  });

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

  const stats = {
    clients: clientsData?.pagination?.total || clientsData?.data?.length || 0,
    products: productsData?.pagination?.total || productsData?.data?.length || 0,
    verificationTypes:
      verificationTypesData?.pagination?.total || verificationTypesData?.data?.length || 0,
    documentTypes: documentTypesData?.pagination?.total || documentTypesData?.data?.length || 0,
    activeCases:
      (dashboardStatsData?.data?.inProgressCases || 0) + (dashboardStatsData?.data?.pendingCases || 0),
  };

  const tabCounts: Record<ClientManagementTab, number> = {
    clients: stats.clients,
    products: stats.products,
    'verification-types': stats.verificationTypes,
    'document-types': stats.documentTypes,
  };

  const pageActions: Record<ClientManagementTab, React.ReactNode> = {
    clients: (
      <>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => handleBulkImport('clients')}>
          Import
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateClient(true)}>
          Add Client
        </Button>
      </>
    ),
    products: (
      <>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => handleBulkImport('products')}>
          Import
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateProduct(true)}>
          Add Product
        </Button>
      </>
    ),
    'verification-types': (
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateVerificationType(true)}>
        Add Type
      </Button>
    ),
    'document-types': (
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateDocumentType(true)}>
        Add Document Type
      </Button>
    ),
  };

  return (
    <Page
      shell
      title="Client & Product Management"
      subtitle="Manage clients, products, verification types, and their relationships."
      actions={pageActions[activeTab]}
    >
      <Section>
        <Stack gap={5}>
          <ClientManagementSummaryCards stats={stats} />

          <Card>
            <CardHeader>
              <Stack gap={2}>
                <CardTitle>Management Console</CardTitle>
                <CardDescription>
                  Create, edit, and manage clients, products, verification types, and documents.
                </CardDescription>
              </Stack>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as ClientManagementTab)}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui-gap-4)' }}
              >
                <Box style={{ overflowX: 'auto' }}>
                  <TabsList
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(11rem, 1fr))',
                      minWidth: '44rem',
                    }}
                  >
                    {([
                      ['clients', 'Clients'],
                      ['products', 'Products'],
                      ['verification-types', 'Verification Types'],
                      ['document-types', 'Document Types'],
                    ] as Array<[ClientManagementTab, string]>).map(([value, label]) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      >
                        <Text as="span" variant="label">{label}</Text>
                        {tabCounts[value] > 0 ? (
                          <Badge variant="secondary">{tabCounts[value]}</Badge>
                        ) : null}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Box>

                <TabsContent value="clients">
                  <ClientManagementTabPanel
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    onSearchClear={clearSearch}
                    isSearchLoading={isDebouncing}
                    searchPlaceholder="Search clients by name, email or code..."
                    actions={
                      <Stack direction="horizontal" gap={2} wrap="wrap">
                        <Button variant="outline" size="sm" icon={<Upload size={16} />} onClick={() => handleBulkImport('clients')}>
                          Import
                        </Button>
                        <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowCreateClient(true)}>
                          Add Client
                        </Button>
                      </Stack>
                    }
                    pagination={clientsData?.pagination}
                    currentPage={clientsPage}
                    onPrev={() => setClientsPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setClientsPage((prev) => prev + 1)}
                    pageLabel="clients"
                    rowCount={clientsData?.data?.length || 0}
                  >
                    <ClientsTable data={clientsData?.data || []} isLoading={clientsLoading} />
                  </ClientManagementTabPanel>
                </TabsContent>

                <TabsContent value="products">
                  <ClientManagementTabPanel
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    onSearchClear={clearSearch}
                    isSearchLoading={isDebouncing}
                    searchPlaceholder="Search products by name, code or category..."
                    actions={
                      <Stack direction="horizontal" gap={2} wrap="wrap">
                        <Button variant="outline" size="sm" icon={<Upload size={16} />} onClick={() => handleBulkImport('products')}>
                          Import
                        </Button>
                        <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowCreateProduct(true)}>
                          Add Product
                        </Button>
                      </Stack>
                    }
                    pagination={productsData?.pagination}
                    currentPage={productsPage}
                    onPrev={() => setProductsPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setProductsPage((prev) => prev + 1)}
                    pageLabel="products"
                    rowCount={productsData?.data?.length || 0}
                  >
                    <ProductsTable data={productsData?.data || []} isLoading={productsLoading} />
                  </ClientManagementTabPanel>
                </TabsContent>

                <TabsContent value="verification-types">
                  <ClientManagementTabPanel
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    onSearchClear={clearSearch}
                    isSearchLoading={isDebouncing}
                    searchPlaceholder="Search verification types by name, code or category..."
                    actions={
                      <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowCreateVerificationType(true)}>
                        Add Type
                      </Button>
                    }
                    minWidth={600}
                    pagination={verificationTypesData?.pagination}
                    currentPage={verificationTypesPage}
                    onPrev={() => setVerificationTypesPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setVerificationTypesPage((prev) => prev + 1)}
                    pageLabel="verification types"
                    rowCount={verificationTypesData?.data?.length || 0}
                  >
                    <VerificationTypesTable
                      data={verificationTypesData?.data || []}
                      isLoading={verificationTypesLoading}
                    />
                  </ClientManagementTabPanel>
                </TabsContent>

                <TabsContent value="document-types">
                  <ClientManagementTabPanel
                    searchValue={searchValue}
                    onSearchChange={setSearchValue}
                    onSearchClear={clearSearch}
                    isSearchLoading={isDebouncing}
                    searchPlaceholder="Search document types by name, code or category..."
                    actions={
                      <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowCreateDocumentType(true)}>
                        Add Document Type
                      </Button>
                    }
                    minWidth={700}
                    pagination={documentTypesData?.pagination}
                    currentPage={documentTypesPage}
                    onPrev={() => setDocumentTypesPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setDocumentTypesPage((prev) => prev + 1)}
                    pageLabel="document types"
                    rowCount={documentTypesData?.data?.length || 0}
                  >
                    <DocumentTypesTable
                      data={documentTypesData?.data || []}
                      isLoading={documentTypesLoading}
                    />
                  </ClientManagementTabPanel>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <CreateClientDialog open={showCreateClient} onOpenChange={setShowCreateClient} />
          <CreateProductDialog open={showCreateProduct} onOpenChange={setShowCreateProduct} />
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
        </Stack>
      </Section>
    </Page>
  );
}
