import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, MapPin, Building, Calendar, Hash } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { locationsService } from '@/services/locations';
import type { Country } from '@/types/location';

interface CountryDetailsDialogProps {
  country: Country;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CountryDetailsDialog({ country, open, onOpenChange }: CountryDetailsDialogProps) {
  // Fetch states for this country
  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: ['states', { country: country.name }],
    queryFn: () => locationsService.getStates({ country: country.name }),
    enabled: open,
  });

  const states = statesData?.data || [];

  const getContinentColor = (continent: string) => {
    const colors: Record<string, string> = {
      'Asia': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      'Europe': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      'North America': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      'South America': 'bg-yellow-100 text-orange-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      'Africa': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      'Oceania': 'bg-green-100 text-cyan-800 dark:bg-green-900/20 dark:text-green-300',
      'Antarctica': 'bg-muted text-gray-600',
    };
    return colors[continent] || 'bg-muted text-gray-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>{country.name}</span>
          </DialogTitle>
          <DialogDescription>
            Country details and associated states
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Globe className="h-4 w-4" />
                    <span>Country Name</span>
                  </div>
                  <p className="font-medium">{country.name}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Hash className="h-4 w-4" />
                    <span>Country Code</span>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {country.code}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>Continent</span>
                  </div>
                  <Badge className={getContinentColor(country.continent)}>
                    {country.continent}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Created</span>
                  </div>
                  <p className="text-sm">
                    {new Date(country.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* States Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Associated States</span>
                <Badge variant="secondary">{states.length}</Badge>
              </CardTitle>
              <CardDescription>
                States and territories within this country
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : states.length > 0 ? (
                <div className="space-y-2">
                  {states.map((state) => (
                    <div
                      key={state.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <MapPin className="h-4 w-4 text-gray-600" />
                        <div>
                          <p className="font-medium">{state.name}</p>
                          <p className="text-sm text-gray-600">Code: {state.code}</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(state.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-600">
                  <Building className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                  <p>No states found for this country</p>
                  <p className="text-sm">States will appear here when created</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-600">{states.length}</p>
                  <p className="text-sm text-gray-600">States</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-600">
                    {states.reduce((acc, state) => acc + (state.cities?.length || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-600">Cities</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-600">
                    {country.continent}
                  </p>
                  <p className="text-sm text-gray-600">Continent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
