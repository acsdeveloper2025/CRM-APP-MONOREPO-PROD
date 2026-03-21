import React, { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Upload } from 'lucide-react';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/Tabs';
import { locationsService } from '@/services/locations';
import { CountriesTable } from '@/components/locations/CountriesTable';
import { StatesTable } from '@/components/locations/StatesTable';
import { CitiesTable } from '@/components/locations/CitiesTable';
import { PincodesTable } from '@/components/locations/PincodesTable';
import { AreasTable } from '@/components/locations/AreasTable';
import { LocationsSummaryCards } from '@/components/locations/LocationsSummaryCards';
import { LocationsTabPanel } from '@/components/locations/LocationsTabPanel';
import { CreateCountryDialog } from '@/components/locations/CreateCountryDialog';
import { CreateStateDialog } from '@/components/locations/CreateStateDialog';
import { CreateCityDialog } from '@/components/locations/CreateCityDialog';
import { CreatePincodeDialog } from '@/components/locations/CreatePincodeDialog';
import { CascadingCreatePincodeDialog } from '@/components/locations/CascadingCreatePincodeDialog';
import { CreateAreaDialog } from '@/components/locations/CreateAreaDialog';
import { BulkImportLocationDialog } from '@/components/locations/BulkImportLocationDialog';
import { useUnifiedSearch } from '@/hooks/useUnifiedSearch';
import { UnifiedSearchInput } from '@/ui/components/UnifiedSearchInput';
import { PincodeArea } from '@/types/location';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

type LocationTab = 'countries' | 'states' | 'cities' | 'pincodes' | 'areas';

export function LocationsPage() {
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
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

  const validTabs = ['countries', 'states', 'cities', 'pincodes', 'areas'] as const;

  const queryTab = searchParams.get('tab');
  const rawTab = tabParam || queryTab || 'countries';
  const activeTab: LocationTab = validTabs.includes(rawTab as LocationTab)
    ? (rawTab as LocationTab)
    : 'countries';

  React.useEffect(() => {
    if (!tabParam) {
      navigate(`/locations/${activeTab}`, { replace: true });
      return;
    }
    if (tabParam !== activeTab) {
      navigate(`/locations/${activeTab}`, { replace: true });
    }
  }, [tabParam, activeTab, navigate]);

  // Handle tab change and update URL
  const handleTabChange = (newTab: string) => {
    navigate(`/locations/${newTab}`);
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
    placeholderData: keepPreviousData,
  });

  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: ['states', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getStates({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'states',
    placeholderData: keepPreviousData,
  });

  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getCities({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize,
    }),
    enabled: activeTab === 'cities',
    placeholderData: keepPreviousData,
  });

  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getPincodes({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize
    }),
    enabled: activeTab === 'pincodes',
    placeholderData: keepPreviousData,
  });

  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ['areas', debouncedSearchValue, currentPage, pageSize],
    queryFn: () => locationsService.getAreas({
      search: debouncedSearchValue || undefined,
      page: currentPage,
      limit: pageSize
    }),
    enabled: activeTab === 'areas',
    placeholderData: keepPreviousData,
  });

  const { data: locationStats } = useQuery({
    queryKey: ['locations-summary-counts'],
    queryFn: async () => {
      const [countries, states, cities, pincodes, areas] = await Promise.all([
        locationsService.getCountries({ page: 1, limit: 1 }).catch(() => null),
        locationsService.getStates({ page: 1, limit: 1 }).catch(() => null),
        locationsService.getCities({ page: 1, limit: 1 }).catch(() => null),
        locationsService.getPincodes({ page: 1, limit: 1 }).catch(() => null),
        locationsService.getAreas({ page: 1, limit: 1 }).catch(() => null),
      ]);

      const readTotal = (
        payload: { pagination?: { total?: number }; data?: unknown[] } | null | undefined
      ): number => {
        if (!payload) {return 0;}
        if (typeof payload.pagination?.total === 'number') {
          return payload.pagination.total;
        }
        return Array.isArray(payload.data) ? payload.data.length : 0;
      };

      return {
        countries: readTotal(countries),
        states: readTotal(states),
        cities: readTotal(cities),
        pincodes: readTotal(pincodes),
        areas: readTotal(areas),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleBulkImport = (type: 'countries' | 'states' | 'cities' | 'pincodes') => {
    setBulkImportType(type);
    setShowBulkImport(true);
  };

  const getTabStats = () => {
    if (locationStats) {
      return locationStats;
    }

    return {
      countries: countriesData?.data?.length || 0,
      states: statesData?.data?.length || 0,
      cities: citiesData?.data?.length || 0,
      pincodes: pincodesData?.pagination?.total || pincodesData?.data?.length || 0,
      areas: areasData?.pagination?.total || areasData?.data?.length || 0,
    };
  };

  const stats = getTabStats();

  const tabCounts: Record<LocationTab, number> = {
    countries: stats.countries,
    states: stats.states,
    cities: stats.cities,
    pincodes: stats.pincodes,
    areas: stats.areas,
  };

  const pageActions: Record<LocationTab, React.ReactNode> = {
    countries: (
      <>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => handleBulkImport('countries')}>
          Import
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateCountry(true)}>
          Add Country
        </Button>
      </>
    ),
    states: (
      <>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => handleBulkImport('states')}>
          Import
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateState(true)}>
          Add State
        </Button>
      </>
    ),
    cities: (
      <>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => handleBulkImport('cities')}>
          Import
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateCity(true)}>
          Add City
        </Button>
      </>
    ),
    pincodes: (
      <>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => handleBulkImport('pincodes')}>
          Import
        </Button>
        <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setShowCreatePincode(true)}>
          Quick Add
        </Button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCascadingCreatePincode(true)}>
          Add Pincode
        </Button>
      </>
    ),
    areas: (
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateArea(true)}>
        Add Area
      </Button>
    ),
  };

  // const _continents = ['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];

  return (
    <Page
      shell
      title="Location Management"
      subtitle="Manage cities, states, pincodes, and geographical data."
      actions={pageActions[activeTab]}
    >
      <Section>
        <Stack gap={5}>
          <LocationsSummaryCards stats={stats} />

          <Card>
            <CardHeader>
              <Stack gap={2}>
                <CardTitle>Location Database</CardTitle>
                <CardDescription>
                  Manage countries, states, cities, pincodes, and areas from one operational workspace.
                </CardDescription>
              </Stack>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ui-gap-4)' }}
              >
                <Stack gap={3}>
                  <Box style={{ overflowX: 'auto' }}>
                    <TabsList
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, minmax(10rem, 1fr))',
                        minWidth: '52rem',
                      }}
                    >
                      {([
                        ['countries', 'Countries'],
                        ['states', 'States'],
                        ['cities', 'Cities'],
                        ['pincodes', 'Pincodes'],
                        ['areas', 'Areas'],
                      ] as Array<[LocationTab, string]>).map(([value, label]) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          <Text as="span" variant="label">{label}</Text>
                          <Badge variant="secondary">{tabCounts[value]}</Badge>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Box>

                  <UnifiedSearchInput
                    value={searchValue}
                    onChange={setSearchValue}
                    onClear={clearSearch}
                    isLoading={isDebouncing}
                    placeholder={`Search ${activeTab}...`}
                  />
                </Stack>

                <TabsContent value="countries">
                  <LocationsTabPanel
                    pagination={countriesData?.pagination}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    entityLabel="countries"
                    onPrev={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setCurrentPage((prev) => prev + 1)}
                  >
                    <CountriesTable
                      data={countriesData?.data || []}
                      isLoading={countriesLoading}
                    />
                  </LocationsTabPanel>
                </TabsContent>

                <TabsContent value="states">
                  <LocationsTabPanel
                    pagination={statesData?.pagination}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    entityLabel="states"
                    onPrev={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setCurrentPage((prev) => prev + 1)}
                  >
                    <StatesTable
                      data={statesData?.data || []}
                      isLoading={statesLoading}
                    />
                  </LocationsTabPanel>
                </TabsContent>

                <TabsContent value="cities">
                  <LocationsTabPanel
                    pagination={citiesData?.pagination}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    entityLabel="cities"
                    onPrev={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setCurrentPage((prev) => prev + 1)}
                  >
                    <CitiesTable
                      data={citiesData?.data || []}
                      isLoading={citiesLoading}
                    />
                  </LocationsTabPanel>
                </TabsContent>

                <TabsContent value="pincodes">
                  <LocationsTabPanel
                    pagination={pincodesData?.pagination}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    entityLabel="pincodes"
                    onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCurrentPage((p) => p + 1)}
                  >
                    <PincodesTable
                      data={pincodesData?.data || []}
                      isLoading={pincodesLoading}
                    />
                  </LocationsTabPanel>
                </TabsContent>

                <TabsContent value="areas">
                  <LocationsTabPanel
                    pagination={areasData?.pagination}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    entityLabel="areas"
                    onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    onNext={() => setCurrentPage((p) => p + 1)}
                  >
                    <AreasTable
                      data={(areasData?.data as unknown as PincodeArea[]) || []}
                      isLoading={areasLoading}
                    />
                  </LocationsTabPanel>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

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
        </Stack>
      </Section>
    </Page>
  );
}
