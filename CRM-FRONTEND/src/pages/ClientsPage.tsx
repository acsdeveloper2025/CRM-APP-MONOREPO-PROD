import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientsService } from '@/services/clients';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { ProductsTable } from '@/components/clients/ProductsTable';
import { VerificationTypesTable } from '@/components/clients/VerificationTypesTable';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { CreateProductDialog } from '@/components/clients/CreateProductDialog';
import { CreateVerificationTypeDialog } from '@/components/clients/CreateVerificationTypeDialog';
import { BulkImportDialog } from '@/components/clients/BulkImportDialog';

export function ClientsPage() {
  const [activeTab, setActiveTab] = useState('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateVerificationType, setShowCreateVerificationType] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<'clients' | 'products'>('clients');


  // Fetch data based on active tab
  const { data: clientsData, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ['clients', searchQuery],
    queryFn: () => clientsService.getClients({ search: searchQuery }),
    enabled: activeTab === 'clients',
  });



  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: () => clientsService.getProducts({ search: searchQuery }),
    enabled: activeTab === 'products',
  });

  const { data: verificationTypesData, isLoading: verificationTypesLoading } = useQuery({
    queryKey: ['verification-types', searchQuery],
    queryFn: () => clientsService.getVerificationTypes({ search: searchQuery }),
    enabled: activeTab === 'verification-types',
  });

  const handleBulkImport = (type: 'clients' | 'products') => {
    setBulkImportType(type);
    setShowBulkImport(true);
  };

  const getTabStats = () => {
    return {
      clients: clientsData?.data?.length || 0,
      products: productsData?.data?.length || 0,
      verificationTypes: verificationTypesData?.data?.length || 0,
    };
  };

  const stats = getTabStats();

  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client & Product Management</h1>
          <p className="text-muted-foreground">
            Manage clients, products, verification types, and their relationships
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clients}</div>
            <p className="text-xs text-muted-foreground">
              Active client organizations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.products}</div>
            <p className="text-xs text-muted-foreground">
              Products across all clients
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verification Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verificationTypes}</div>
            <p className="text-xs text-muted-foreground">
              Available verification types
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
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="clients">
                  Clients
                  {stats.clients > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.clients}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="products">
                  Products
                  {stats.products > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.products}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="verification-types">
                  Verification Types
                  {stats.verificationTypes > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.verificationTypes}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Search and Actions */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                
                {activeTab === 'clients' && (
                  <>
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
                  </>
                )}
                
                {activeTab === 'products' && (
                  <>
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
                  </>
                )}
                
                {activeTab === 'verification-types' && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreateVerificationType(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Type
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="clients" className="space-y-4">
              <ClientsTable
                data={clientsData?.data || []}
                isLoading={clientsLoading}
              />
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <ProductsTable
                data={productsData?.data || []}
                isLoading={productsLoading}
              />
            </TabsContent>

            <TabsContent value="verification-types" className="space-y-4">
              <VerificationTypesTable
                data={verificationTypesData?.data || []}
                isLoading={verificationTypesLoading}
              />
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
      
      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        type={bulkImportType}
      />
    </div>
  );
}
