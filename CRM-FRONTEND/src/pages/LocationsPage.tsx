import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Upload, MapPin, Building, Globe } from 'lucide-react';
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

  // Get active tab from URL or default to 'countries'
  const activeTab = searchParams.get('tab') || 'countries';

  // Handle tab change and update URL
  const handleTabChange = (newTab: string) => {
    setSearchParams({ tab: newTab });
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

  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries', debouncedSearchValue],
    queryFn: () => locationsService.getCountries({ search: debouncedSearchValue || undefined }),
    enabled: activeTab === 'countries',
  });

  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: ['states', debouncedSearchValue],
    queryFn: () => locationsService.getStates({ search: debouncedSearchValue || undefined }),
    enabled: activeTab === 'states',
  });

  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', debouncedSearchValue],
    queryFn: () => locationsService.getCities({ search: debouncedSearchValue || undefined }),
    enabled: activeTab === 'cities',
  });

  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', debouncedSearchValue],
    queryFn: () => locationsService.getPincodes({ search: debouncedSearchValue || undefined }),
    enabled: activeTab === 'pincodes',
  });

  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['areas', debouncedSearchValue],
    queryFn: () => locationsService.getAreas({ search: debouncedSearchValue || undefined }),
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
      pincodes: pincodesData?.data?.length || 0,
      areas: areasData?.data?.length || 0,
    };
  };

  const stats = getTabStats();

  const continents = ['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Location Management</h1>
          <p className="text-muted-foreground">
            Manage cities, states, pincodes, and geographical data
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Countries</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.countries}</div>
            <p className="text-xs text-muted-foreground">
              Across all continents
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total States</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.states}</div>
            <p className="text-xs text-muted-foreground">
              Across all countries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cities</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cities}</div>
            <p className="text-xs text-muted-foreground">
              Across all states and countries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pincodes</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pincodes}</div>
            <p className="text-xs text-muted-foreground">
              Postal codes across all cities
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

            <TabsContent value="countries" className="space-y-4">
              <CountriesTable
                data={countriesData?.data || []}
                isLoading={countriesLoading}
              />
            </TabsContent>

            <TabsContent value="states" className="space-y-4">
              <StatesTable
                data={statesData?.data || []}
                isLoading={statesLoading}
              />
            </TabsContent>

            <TabsContent value="cities" className="space-y-4">
              <CitiesTable
                data={citiesData?.data || []}
                isLoading={citiesLoading}
              />
            </TabsContent>

            <TabsContent value="pincodes" className="space-y-4">
              <PincodesTable
                data={pincodesData?.data || []}
                isLoading={pincodesLoading}
              />
            </TabsContent>

            <TabsContent value="areas" className="space-y-4">
              <AreasTable
                data={areasData?.data || []}
                isLoading={areasLoading}
              />
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
