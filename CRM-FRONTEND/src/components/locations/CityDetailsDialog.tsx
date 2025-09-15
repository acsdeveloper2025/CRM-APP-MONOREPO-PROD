import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building, MapPin, Calendar, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { locationsService } from '@/services/locations';
import { City } from '@/types/location';

interface CityDetailsDialogProps {
  city: City;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CityDetailsDialog({ city, open, onOpenChange }: CityDetailsDialogProps) {
  const { data: pincodesData, isLoading } = useQuery({
    queryKey: ['city-pincodes', city.id],
    queryFn: () => locationsService.getPincodesByCity(city.id),
    enabled: open,
  });

  const pincodes = pincodesData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>{city.name}</span>
          </DialogTitle>
          <DialogDescription>
            Detailed information about this city and its pincodes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* City Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">City Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">City Name</span>
                  </div>
                  <p className="text-lg font-semibold">{city.name}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">State</span>
                  </div>
                  <Badge variant="outline">{city.state}</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Country</span>
                  </div>
                  <p>{city.country}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Created</span>
                  </div>
                  <p>{new Date(city.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Pincodes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Associated Pincodes</span>
                <Badge variant="secondary">{pincodes.length} pincodes</Badge>
              </CardTitle>
              <CardDescription>
                All postal codes associated with this city
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pincodes.length > 0 ? (
                <div className="grid gap-3">
                  {pincodes.map((pincode) => (
                    <div
                      key={pincode.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="font-mono">
                              {pincode.code}
                            </Badge>
                            <span className="font-medium">{pincode.area}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(pincode.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No pincodes found</h3>
                  <p className="text-muted-foreground">
                    This city doesn't have any pincodes assigned yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
