import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { locationsService } from '@/services/locations';
import { EnhancedAreasMultiSelect } from './EnhancedAreasMultiSelect';

interface CascadingLocationSelectorProps {
  // Form control
  form: any;
  
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
      if (!selectedCountryId) return Promise.resolve({ data: [] });
      const selectedCountry = countries.find(c => c.id === selectedCountryId);
      if (!selectedCountry) return Promise.resolve({ data: [] });
      return locationsService.getStates({ country: selectedCountry.name, limit: 100 });
    },
    enabled: !!selectedCountryId,
  });

  // Fetch cities filtered by state
  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', selectedStateId],
    queryFn: () => {
      if (!selectedStateId) return Promise.resolve({ data: [] });
      const selectedState = states.find(s => s.id === selectedStateId);
      if (!selectedState) return Promise.resolve({ data: [] });
      return locationsService.getCities({ state: selectedState.name, limit: 100 });
    },
    enabled: !!selectedStateId,
  });

  // Fetch pincodes filtered by city (for edit mode)
  const { data: pincodesData, isLoading: pincodesLoading } = useQuery({
    queryKey: ['pincodes', selectedCityId],
    queryFn: () => {
      if (!selectedCityId || mode === 'create') return Promise.resolve({ data: [] });
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
    if (showPincodeInput) form.setValue(pincodeField, '');
    if (showAreasSelect) form.setValue(areasField, []);
  };

  const handleStateChange = (stateId: string) => {
    form.setValue(stateField, stateId);
    form.setValue(cityField, '');
    if (showPincodeInput) form.setValue(pincodeField, '');
    if (showAreasSelect) form.setValue(areasField, []);
  };

  const handleCityChange = (cityId: string) => {
    form.setValue(cityField, cityId);
    if (showPincodeInput) form.setValue(pincodeField, '');
    if (showAreasSelect) form.setValue(areasField, []);
  };

  const handlePincodeChange = (pincodeCode: string) => {
    form.setValue(pincodeField, pincodeCode);
    if (showAreasSelect) form.setValue(areasField, []);
  };



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
    <div className="space-y-4">
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
                  {countriesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    <div className="flex flex-col">
                      <span>{country.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {country.code} • {country.continent}
                      </span>
                    </div>
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
                  {statesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    <div className="flex flex-col">
                      <span>{state.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {state.code} • {state.cityCount || 0} cities
                      </span>
                    </div>
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
                  {citiesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    <div className="flex flex-col">
                      <span>{city.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {city.state}, {city.country}
                      </span>
                    </div>
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
                    className="font-mono"
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
                      {pincodesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pincodes.map((pincode) => (
                      <SelectItem key={pincode.id} value={pincode.code}>
                        <div className="flex flex-col">
                          <span className="font-mono">{pincode.code}</span>
                          <span className="text-xs text-muted-foreground">
                            {pincode.areas?.length || 0} areas
                          </span>
                        </div>
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
    </div>
  );
}
