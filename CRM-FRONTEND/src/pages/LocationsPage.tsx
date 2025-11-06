import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, MapPin, Building, Globe, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { locationsService } from '@/services/locations';
import { CountriesTable } from '@/components/locations/CountriesTable';
import { StatesTable } from '@/components/locations/StatesTable';
import { CitiesTable } from '@/components/locations/CitiesTable';
import { PincodesTable } from '@/components/locations/PincodesTable';
import { AreasTable } from '@/components/locations/AreasTable';
import { CreateCountryDialog } from '@/components/locations/CreateCountryDialog';
import { CreateStateDialog } from '@/components/locations/CreateStateDialog';
import { CreateCityDialog } from '@/components/locations/CreateCityDialog';
import { CreatePincodeDialog } from '@/components/locations/CreatePincodeDialog';
import { CascadingCreatePincodeDialog } from '@/components/locations/CascadingCreatePincodeDialog';
import { CreateAreaDialog } from '@/components/locations/CreateAreaDialog';
import { BulkImportLocationDialog } from '@/components/locations/BulkImportLocationDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/components/ui/unified-search-input';

export function LocationsPage() {
  console.log('LocationsPage component loaded');
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateCountry, setShowCreateCountry] = useState(false);
  const [showCreateState, setShowCreateState] = useState(false);
  const [showCreateCity, setShowCreateCity] = useState(false);
  const [showCreatePincode, setShowCreatePincode] = useState(false);
  const [showCascadingCreatePincode, setShowCascadingCreatePincode] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<'countries' | 'states' | 'cities' | 'pincodes'>('countries');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, _setPageSize] = useState(100); // Increased default page size

  // Get active tab from URL or default to 'countries'
  const activeTab = searchParams.get('tab') || 'countries';

  // Handle tab change and update URL
  const handleTabChange = (newTab: string) => {
    setSearchParams({ tab: newTab });
    setCurrentPage(1); // Reset to page 1 when changing tabs
  };

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

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getCountries({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'countries',
  });

  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: ['states', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getStates({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'states',
  });

  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getCities({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'cities',
  });

  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getPincodes({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize
    }),
    enabled: activeTab === 'pincodes',
  });

  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['areas', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getAreas({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize
    }),
    enabled: activeTab === 'areas',
  });

  const handleBulkImport = (type: 'countries' | 'states' | 'cities' | 'pincodes') => {
    setBulkImportType(type);
    setShowBulkImport(true);
  };

  const getTabStats = () => {
    return {
      countries: countriesData?.data?.length || 0,
      states: statesData?.data?.length || 0,
      cities: citiesData?.data?.length || 0,
      pincodes: pincodesData?.pagination?.total || pincodesData?.data?.length || 0,
      areas: areasData?.pagination?.total || areasData?.data?.length || 0,
    };
  };

  const stats = getTabStats();

  const _continents = ['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Location Management</h1>
          <p className="text-gray-600">
            Manage cities, states, pincodes, and geographical data
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Countries</CardTitle>
            <Globe className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.countries}</div>
            <p className="text-xs text-gray-600">
              Across all continents
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total States</CardTitle>
            <MapPin className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.states}</div>
            <p className="text-xs text-gray-600">
              Across all countries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cities</CardTitle>
            <Building className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cities}</div>
            <p className="text-xs text-gray-600">
              Across all states and countries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pincodes</CardTitle>
            <MapPin className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pincodes}</div>
            <p className="text-xs text-gray-600">
              Postal codes across all cities
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Areas</CardTitle>
            <Map className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.areas}</div>
            <p className="text-xs text-gray-600">
              Areas across all pincodes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Location Database</CardTitle>
              <CardDescription>
                Manage geographical data including cities, states, and postal codes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <div className="flex flex-col gap-4">
              {/* Tab List and Action Buttons Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <TabsList className="flex min-w-max space-x-1">
                    <TabsTrigger value="countries" className="whitespace-nowrap">
                      Countries
                      <Badge variant="secondary" className="ml-2">
                        {stats.countries}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="states" className="whitespace-nowrap">
                      States
                      <Badge variant="secondary" className="ml-2">
                        {stats.states}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="cities" className="whitespace-nowrap">
                      Cities
                      <Badge variant="secondary" className="ml-2">
                        {stats.cities}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pincodes" className="whitespace-nowrap">
                      Pincodes
                      <Badge variant="secondary" className="ml-2">
                        {stats.pincodes}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="areas" className="whitespace-nowrap">
                      Areas
                      <Badge variant="secondary" className="ml-2">
                        {stats.areas}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                <div className="flex flex-wrap gap-2">
                {activeTab === 'countries' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('countries')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateCountry(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Country
                    </Button>
                  </>
                )}

                {activeTab === 'states' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('states')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateState(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add State
                    </Button>
                  </>
                )}

                {activeTab === 'cities' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('cities')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateCity(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add City
                    </Button>
                  </>
                )}

                {activeTab === 'pincodes' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('pincodes')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreatePincode(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Quick Add
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCascadingCreatePincode(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Pincode
                    </Button>
                  </>
                )}

                {activeTab === 'areas' && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreateArea(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Area
                  </Button>
                )}
              </div>
            </div>

            {/* Search Input Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <UnifiedSearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  onClear={clearSearch}
                  isLoading={isDebouncing}
                  placeholder={`Search ${activeTab}...`}
                />
              </div>
            </div>
            </div>

            <TabsContent value="countries" className="space-y-4">
              <CountriesTable
                data={countriesData?.data || []}
                isLoading={countriesLoading}
              />
              {countriesData?.pagination && (
                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, countriesData.pagination.total)} of {countriesData.pagination.total} countries
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {countriesData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage >= (countriesData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="states" className="space-y-4">
              <StatesTable
                data={statesData?.data || []}
                isLoading={statesLoading}
              />
              {statesData?.pagination && (
                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, statesData.pagination.total)} of {statesData.pagination.total} states
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {statesData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage >= (statesData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cities" className="space-y-4">
              <CitiesTable
                data={citiesData?.data || []}
                isLoading={citiesLoading}
              />
              {citiesData?.pagination && (
                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, citiesData.pagination.total)} of {citiesData.pagination.total} cities
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {citiesData.pagination.totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage >= (citiesData.pagination.totalPages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pincodes" className="space-y-4">
              <PincodesTable
                data={pincodesData?.data || []}
                isLoading={pincodesLoading}
              />
              {pincodesData?.pagination && (
                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pincodesData.pagination.total)} of {pincodesData.pagination.total} pincodes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!pincodesData.pagination.hasPrev}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {pincodesData.pagination.pages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!pincodesData.pagination.hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="areas" className="space-y-4">
              <AreasTable
                data={areasData?.data || []}
                isLoading={areasLoading}
              />
              {areasData?.pagination && (
                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, areasData.pagination.total)} of {areasData.pagination.total} areas
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!areasData.pagination.hasPrev}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {areasData.pagination.pages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!areasData.pagination.hasNext}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateCountryDialog
        open={showCreateCountry}
        onOpenChange={setShowCreateCountry}
      />

      <CreateStateDialog
        open={showCreateState}
        onOpenChange={setShowCreateState}
      />

      <CreateCityDialog
        open={showCreateCity}
        onOpenChange={setShowCreateCity}
      />

      <CreatePincodeDialog
        open={showCreatePincode}
        onOpenChange={setShowCreatePincode}
      />

      <CascadingCreatePincodeDialog
        open={showCascadingCreatePincode}
        onOpenChange={setShowCascadingCreatePincode}
      />

      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />

      <BulkImportLocationDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        type={bulkImportType}
      />
    </div>
  );
}
