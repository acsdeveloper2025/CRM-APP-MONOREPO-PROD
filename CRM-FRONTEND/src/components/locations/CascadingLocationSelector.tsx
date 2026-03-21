import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/Form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/Select';
import { Input } from '@/ui/components/Input';
import { Loader2 } from 'lucide-react';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { EnhancedAreasMultiSelect } from './EnhancedAreasMultiSelect';
import { ApiResponse } from '@/types/api';
import { Country, State, City, Pincode } from '@/types/location';
import { UseFormReturn } from 'react-hook-form';

interface CascadingLocationSelectorProps {
  // Form control
   
  form: UseFormReturn<any>;
  
  // Field names
  countryField?: string;
  stateField?: string;
  cityField?: string;
  pincodeField?: string;
  areasField?: string;
  
  // Configuration
  mode: 'create' | 'edit';
  showPincodeInput?: boolean;
  showAreasSelect?: boolean;
  disabled?: boolean;
  
  // Callbacks
  onLocationChange?: (location: {
    countryId?: string;
    stateId?: string;
    cityId?: string;
    pincodeCode?: string;
    areaIds?: string[];
  }) => void;
}

export function CascadingLocationSelector({
  form,
  countryField = 'countryId',
  stateField = 'stateId', 
  cityField = 'cityId',
  pincodeField = 'pincodeCode',
  areasField = 'areas',
  mode,
  showPincodeInput = true,
  showAreasSelect = true,
  disabled = false,
  onLocationChange,
}: CascadingLocationSelectorProps) {
  
  // Watch form values for cascading updates
  const selectedCountryId = form.watch(countryField);
  const selectedStateId = form.watch(stateField);
  const selectedCityId = form.watch(cityField);
  const selectedPincodeCode = form.watch(pincodeField);
  const selectedAreas = form.watch(areasField);

  // Fetch countries
  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: () => locationsService.getCountries({ limit: 100 }),
  });

  // Fetch states filtered by country
  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: ['states', selectedCountryId],
    queryFn: () => {
      if (!selectedCountryId) {return Promise.resolve({ success: true, message: '', data: [] } as ApiResponse<State[]>);}
      const selectedCountry = countries.find(
        (c: Country) => String(c.id) === String(selectedCountryId)
      );
      if (!selectedCountry) {return Promise.resolve({ success: true, message: '', data: [] } as ApiResponse<State[]>);}
      return locationsService.getStates({ country: selectedCountry.name, limit: 100 });
    },
    enabled: !!selectedCountryId,
  });

  // Fetch cities filtered by state
  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', selectedStateId],
    queryFn: () => {
      if (!selectedStateId) {return Promise.resolve({ success: true, message: '', data: [] } as ApiResponse<City[]>);}
      const selectedState = states.find((s: State) => String(s.id) === String(selectedStateId));
      if (!selectedState) {return Promise.resolve({ success: true, message: '', data: [] } as ApiResponse<City[]>);}
      return locationsService.getCities({ state: selectedState.name, limit: 100 });
    },
    enabled: !!selectedStateId,
  });

  // Fetch pincodes filtered by city (for edit mode)
  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', selectedCityId],
    queryFn: () => {
      if (!selectedCityId || mode === 'create') {return Promise.resolve({ success: true, message: '', data: [] } as ApiResponse<Pincode[]>);}
      return locationsService.getPincodesByCity(selectedCityId);
    },
    enabled: !!selectedCityId && mode === 'edit',
  });

  // Extract data arrays
  const countries = countriesData?.data || [];
  const states = statesData?.data || [];
  const cities = citiesData?.data || [];
  const pincodes = pincodesData?.data || [];



  // Handle clearing dependent fields when parent changes
  const handleCountryChange = (countryId: string) => {
    form.setValue(countryField, countryId);
    form.setValue(stateField, '');
    form.setValue(cityField, '');
    if (showPincodeInput) {form.setValue(pincodeField, '');}
    // Only clear areas in create mode
    if (showAreasSelect && mode === 'create') {form.setValue(areasField, []);}
  };

  const handleStateChange = (stateId: string) => {
    form.setValue(stateField, stateId);
    form.setValue(cityField, '');
    if (showPincodeInput) {form.setValue(pincodeField, '');}
    // Only clear areas in create mode
    if (showAreasSelect && mode === 'create') {form.setValue(areasField, []);}
  };

  const handleCityChange = (cityId: string) => {
    form.setValue(cityField, cityId);
    if (showPincodeInput) {form.setValue(pincodeField, '');}
    // Only clear areas in create mode
    if (showAreasSelect && mode === 'create') {form.setValue(areasField, []);}
  };

  const handlePincodeChange = (pincodeCode: string) => {
    form.setValue(pincodeField, pincodeCode);
    // Only clear areas in create mode
    if (showAreasSelect && mode === 'create') {form.setValue(areasField, []);}
  };

  // Keep edit-mode pincode preselected when opening the dialog.
  useEffect(() => {
    if (mode === 'edit' && selectedPincodeCode !== undefined && selectedPincodeCode !== null) {
      const normalized = String(selectedPincodeCode);
      if (selectedPincodeCode !== normalized) {
        form.setValue(pincodeField, normalized);
      }
    }
  }, [mode, selectedPincodeCode, form, pincodeField]);



  // Notify parent of location changes
  useEffect(() => {
    if (onLocationChange) {
      onLocationChange({
        countryId: selectedCountryId,
        stateId: selectedStateId,
        cityId: selectedCityId,
        pincodeCode: selectedPincodeCode,
        areaIds: selectedAreas,
      });
    }
  }, [selectedCountryId, selectedStateId, selectedCityId, selectedPincodeCode, selectedAreas, onLocationChange]);

  return (
    <Stack gap={4}>
      {/* Country Selection */}
      <FormField
        control={form.control}
        name={countryField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country</FormLabel>
            <Select
              onValueChange={handleCountryChange}
              value={field.value || ''}
              disabled={disabled || countriesLoading}
            >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a country" />
                  {countriesLoading && <Loader2 size={16} />}
                  </SelectTrigger>
                </FormControl>
              <SelectContent>
                {countries.map((country: Country) => (
                  <SelectItem key={country.id} value={String(country.id)}>
                    {country.name} ({country.code} • {country.continent})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Select the country for this location
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* State Selection */}
      <FormField
        control={form.control}
        name={stateField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>State</FormLabel>
            <Select
              onValueChange={handleStateChange}
              value={field.value || ''}
              disabled={disabled || !selectedCountryId || statesLoading}
            >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedCountryId ? "Select a state" : "Select country first"} />
                  {statesLoading && <Loader2 size={16} />}
                  </SelectTrigger>
                </FormControl>
              <SelectContent>
                {states.map((state: State) => (
                  <SelectItem key={state.id} value={String(state.id)}>
                    {state.name} ({state.code} • {state.cityCount || 0} cities)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Select the state within the chosen country
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* City Selection */}
      <FormField
        control={form.control}
        name={cityField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>City</FormLabel>
            <Select
              onValueChange={handleCityChange}
              value={field.value || ''}
              disabled={disabled || !selectedStateId || citiesLoading}
            >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedStateId ? "Select a city" : "Select state first"} />
                  {citiesLoading && <Loader2 size={16} />}
                  </SelectTrigger>
                </FormControl>
              <SelectContent>
                {cities.map((city: City) => (
                  <SelectItem key={city.id} value={String(city.id)}>
                    {city.name} ({city.state}, {city.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Select the city within the chosen state
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Pincode Input/Selection */}
      {showPincodeInput && (
        <FormField
          control={form.control}
          name={pincodeField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {mode === 'create' ? 'Pincode' : 'Pincode'}
              </FormLabel>
              {mode === 'create' ? (
                <FormControl>
                  <Input
                    placeholder="Enter 6-digit pincode"
                    value={field.value || ''}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}
                    maxLength={6}
                    disabled={disabled || !selectedCityId}
                  />
                </FormControl>
              ) : (
                <Select
                  onValueChange={handlePincodeChange}
                  value={field.value || ''}
                  disabled={disabled || !selectedCityId || pincodesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedCityId ? "Select a pincode" : "Select city first"} />
                      {pincodesLoading && <Loader2 size={16} />}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pincodes.map((pincode: Pincode) => (
                      <SelectItem key={String(pincode.id)} value={String(pincode.code)}>
                        <Stack gap={1}>
                          <Text
                            as="span"
                            style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}
                          >
                            {String(pincode.code)}
                          </Text>
                          <Text as="span" variant="caption" tone="muted">
                            {pincode.areas?.length || 0} areas
                          </Text>
                        </Stack>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormDescription>
                {mode === 'create' 
                  ? "Enter the 6-digit pincode for this city" 
                  : "Select an existing pincode in this city"
                }
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Areas Selection */}
      {showAreasSelect && (
        <FormField
          control={form.control}
          name={areasField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Areas</FormLabel>
              <FormControl>
                <EnhancedAreasMultiSelect
                  selectedAreaIds={field.value || []}
                  onAreasChange={field.onChange}
                  disabled={disabled || (mode === 'create' ? !selectedPincodeCode : !selectedCityId)}
                  placeholder={
                    mode === 'create' 
                      ? (selectedPincodeCode ? "Select areas for this pincode..." : "Enter pincode first")
                      : (selectedCityId ? "Select areas..." : "Select city first")
                  }
                  maxAreas={15}
                />
              </FormControl>
              <FormDescription>
                Select one or more areas {mode === 'create' ? 'for this pincode' : 'to filter by'} (max 15)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </Stack>
  );
}
