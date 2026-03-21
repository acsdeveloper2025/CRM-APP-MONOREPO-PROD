import { MapPin, Navigation, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import { FormGeoLocation } from '@/types/form';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

interface FormLocationViewerProps {
  location: FormGeoLocation;
  readonly?: boolean;
}

const getGoogleMapsApiKey = (): string => import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';

export function FormLocationViewer({ location, readonly: _readonly = true }: FormLocationViewerProps) {
  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy <= 5) {
      return <Badge variant="default">High Accuracy</Badge>;
    }
    if (accuracy <= 20) {
      return <Badge variant="secondary">Medium Accuracy</Badge>;
    }
    return <Badge variant="outline">Low Accuracy</Badge>;
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
        <CardTitle>
          <Stack direction="horizontal" gap={2} align="center">
            <MapPin size={20} />
            <span>Location Information</span>
            {getAccuracyBadge(location.accuracy)}
          </Stack>
        </CardTitle>
        <CardDescription>
          GPS coordinates captured during verification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          <Box style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Stack gap={2}>
              <Text as="h4" variant="label">Coordinates</Text>
              <Stack gap={1}>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Latitude:</Text>
                  <Text as="span" variant="body-sm" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {location.latitude.toFixed(6)}
                  </Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Longitude:</Text>
                  <Text as="span" variant="body-sm" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {location.longitude.toFixed(6)}
                  </Text>
                </Box>
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text as="span" variant="body-sm" tone="muted">Accuracy:</Text>
                  <Text as="span" variant="body-sm">{location.accuracy}m</Text>
                </Box>
              </Stack>
            </Stack>

            <Stack gap={2}>
              <Text as="h4" variant="label">Capture Details</Text>
              <Stack direction="horizontal" gap={2} align="center">
                <Clock size={12} style={{ color: 'var(--ui-text-muted)' }} />
                <Text as="span" variant="body-sm" tone="muted">Captured:</Text>
                <Text as="span" variant="body-sm">{new Date(location.timestamp).toLocaleString()}</Text>
              </Stack>
            </Stack>
          </Box>

          {location.address && (
            <Stack gap={2}>
              <Text as="h4" variant="label">Reverse Geocoded Address</Text>
              <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '0.75rem' }}>
                <Text variant="body-sm">{location.address}</Text>
              </Box>
            </Stack>
          )}

          <Stack gap={2}>
            <Text as="h4" variant="label">Map Preview</Text>
            <Box style={{ position: 'relative', background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', overflow: 'hidden' }}>
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=${getGoogleMapsApiKey()}&q=${location.latitude},${location.longitude}&zoom=16`}
                width="100%"
                height="200"
                style={{ border: 0, width: '100%' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {!getGoogleMapsApiKey() && (
                <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ui-surface-muted)' }}>
                  <Stack gap={2} align="center" style={{ textAlign: 'center' }}>
                    <MapPin size={32} style={{ color: 'var(--ui-text-muted)' }} />
                    <Text variant="body-sm" tone="muted">Map preview unavailable</Text>
                    <Text variant="caption" tone="muted">Google Maps API key not configured</Text>
                  </Stack>
                </Box>
              )}
            </Box>
          </Stack>

          <Stack direction="horizontal" gap={2} wrap="wrap">
            <Button variant="outline" onClick={openInGoogleMaps} icon={<ExternalLink size={12} />}>
              Open in Google Maps
            </Button>
            <Button variant="outline" onClick={openInAppleMaps} icon={<ExternalLink size={12} />}>
              Open in Apple Maps
            </Button>
            <Button variant="outline" onClick={copyCoordinates} icon={<Navigation size={12} />}>
              Copy Coordinates
            </Button>
          </Stack>

          <Box style={{ background: 'var(--ui-surface-muted)', borderRadius: 'var(--ui-radius-lg)', padding: '0.75rem' }}>
            <Text as="h4" variant="label" style={{ marginBottom: '0.5rem' }}>Accuracy Information</Text>
            <Stack gap={1}>
              <Text variant="caption" tone="muted">
                <strong>GPS Accuracy:</strong> ±{location.accuracy} meters
              </Text>
              <Text variant="caption" tone="muted">
                <strong>Quality:</strong> {
                  location.accuracy <= 5 ? 'High - Suitable for precise location verification' :
                  location.accuracy <= 20 ? 'Medium - Good for general location verification' :
                  'Low - May require additional verification'
                }
              </Text>
              <Text variant="caption" tone="muted">
                <strong>Note:</strong> GPS accuracy can be affected by weather conditions, building structures, and device capabilities.
              </Text>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
