import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Upload, MapPin, Building, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export function LocationsPage() {
  console.log('LocationsPage component loaded');
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedContinent, setSelectedContinent] = useState<string>('all');
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

  // Fetch data based on active tab and filters
  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries', searchQuery, selectedContinent],
    queryFn: () => locationsService.getCountries({
      search: searchQuery,
      continent: selectedContinent !== 'all' ? selectedContinent : undefined,
    }),
    enabled: activeTab === 'countries',
  });

  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: ['states', searchQuery, selectedCountry],
    queryFn: () => locationsService.getStates({
      search: searchQuery,
      country: selectedCountry !== 'all' ? selectedCountry : undefined,
    }),
    enabled: activeTab === 'states',
  });

  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', searchQuery, selectedState, selectedCountry],
    queryFn: () => locationsService.getCities({
      search: searchQuery,
      state: selectedState !== 'all' ? selectedState : undefined,
      country: selectedCountry !== 'all' ? selectedCountry : undefined,
    }),
    enabled: activeTab === 'cities',
  });

  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', searchQuery],
    queryFn: () => locationsService.getPincodes({ search: searchQuery }),
    enabled: activeTab === 'pincodes',
  });

  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['areas', searchQuery, selectedState, selectedCountry],
    queryFn: () => locationsService.getAreas({
      search: searchQuery,
      state: selectedState !== 'all' ? selectedState : undefined,
      country: selectedCountry !== 'all' ? selectedCountry : undefined,
    }),
    enabled: activeTab === 'areas',
  });

  // Fetch filter data
  const { data: stateNamesData } = useQuery({
    queryKey: ['state-names'],
    queryFn: () => locationsService.getStateNames(),
  });

  const { data: countryNamesData } = useQuery({
    queryKey: ['country-names'],
    queryFn: () => locationsService.getCountries(),
  });

  const handleBulkImport = (type: 'countries' | 'states' | 'cities' | 'pincodes') => {
    setBulkImportType(type);
    setShowBulkImport(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedState('all');
    setSelectedCountry('all');
    setSelectedContinent('all');
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
  const stateNames = stateNamesData?.data || [];
  const countryNames = countryNamesData?.data || [];

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
            {/* Debug: Current active tab: {activeTab} */}
            <div className="flex items-center justify-between overflow-x-auto">
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

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {activeTab === 'countries' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkImport('countries')}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Countries
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
                      Import States
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
                      Import Cities
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
                      Import Pincodes
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

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {activeTab === 'countries' && (
                <Select value={selectedContinent} onValueChange={setSelectedContinent}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by continent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Continents</SelectItem>
                    {continents.map((continent) => (
                      <SelectItem key={continent} value={continent}>
                        {continent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(activeTab === 'states' || activeTab === 'cities') && (
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countryNames.map((country) => (
                      <SelectItem key={country.id} value={country.name}>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs bg-muted px-1 rounded">
                            {country.code}
                          </span>
                          <span>{country.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeTab === 'cities' && (
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {stateNames.map((state) => (
                      <SelectItem key={state.id || state.name} value={state.name}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(searchQuery || selectedState !== 'all' || selectedCountry !== 'all' || selectedContinent !== 'all') && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
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
