import React from 'react';
import { MapPin, Navigation, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormLocation } from '@/types/form';

interface FormLocationViewerProps {
  location: FormLocation;
  readonly?: boolean;
}

export function FormLocationViewer({ location, readonly = true }: FormLocationViewerProps) {
  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy <= 5) {
      return <Badge variant="default">High Accuracy</Badge>;
    } else if (accuracy <= 20) {
      return <Badge variant="secondary">Medium Accuracy</Badge>;
    } else {
      return <Badge variant="outline">Low Accuracy</Badge>;
    }
  };

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  const openInAppleMaps = () => {
    const url = `https://maps.apple.com/?q=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  const copyCoordinates = () => {
    const coordinates = `${location.latitude}, ${location.longitude}`;
    navigator.clipboard.writeText(coordinates);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Location Information</span>
          {getAccuracyBadge(location.accuracy)}
        </CardTitle>
        <CardDescription>
          GPS coordinates captured during verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Coordinates */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-sm mb-2">Coordinates</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Latitude:</span>
                  <span className="font-mono">{location.latitude.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Longitude:</span>
                  <span className="font-mono">{location.longitude.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span>{location.accuracy}m</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Capture Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Captured:</span>
                  <span>{new Date(location.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          {location.address && (
            <div>
              <h4 className="font-medium text-sm mb-2">Reverse Geocoded Address</h4>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm">{location.address}</p>
              </div>
            </div>
          )}

          {/* Map Preview */}
          <div>
            <h4 className="font-medium text-sm mb-2">Map Preview</h4>
            <div className="relative bg-muted rounded-lg overflow-hidden">
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${location.latitude},${location.longitude}&zoom=16`}
                width="100%"
                height="200"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full"
              />
              {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Map preview unavailable
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Google Maps API key not configured
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openInGoogleMaps}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Google Maps
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openInAppleMaps}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Apple Maps
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCoordinates}
            >
              <Navigation className="h-3 w-3 mr-1" />
              Copy Coordinates
            </Button>
          </div>

          {/* Accuracy Information */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2">Accuracy Information</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>GPS Accuracy:</strong> ±{location.accuracy} meters
              </p>
              <p>
                <strong>Quality:</strong> {
                  location.accuracy <= 5 ? 'High - Suitable for precise location verification' :
                  location.accuracy <= 20 ? 'Medium - Good for general location verification' :
                  'Low - May require additional verification'
                }
              </p>
              <p>
                <strong>Note:</strong> GPS accuracy can be affected by weather conditions, 
                building structures, and device capabilities.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
