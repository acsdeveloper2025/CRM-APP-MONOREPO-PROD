import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Building, Calendar, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { locationsService } from '@/services/locations';
import type { State } from '@/types/location';

interface StateDetailsDialogProps {
  state: State;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StateDetailsDialog({ state, open, onOpenChange }: StateDetailsDialogProps) {
  // Fetch cities in this state
  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities', 'by-state', state.id],
    queryFn: () => locationsService.getCitiesByState(state.name),
    enabled: open,
  });

  const cities = citiesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {state.name}
          </DialogTitle>
          <DialogDescription>
            Detailed information about {state.name} state
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
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State Name</label>
                  <p className="text-sm font-medium">{state.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">State Code</label>
                  <Badge variant="outline" className="mt-1">
                    {state.code}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{state.country}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(state.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cities in this State */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Cities ({cities.length})
              </CardTitle>
              <CardDescription>
                Cities located in {state.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {citiesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : cities.length > 0 ? (
                <div className="space-y-2">
                  {cities.map((city) => (
                    <div
                      key={city.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{city.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {city.pincodes?.length || 0} pincodes
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {new Date(city.createdAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-medium text-foreground">No cities found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No cities have been added to this state yet.
                  </p>
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
                <div>
                  <p className="text-2xl font-bold">{cities.length}</p>
                  <p className="text-sm text-muted-foreground">Cities</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {cities.reduce((total, city) => total + (city.pincodes?.length || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Pincodes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round((Date.now() - new Date(state.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                  </p>
                  <p className="text-sm text-muted-foreground">Days Old</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
