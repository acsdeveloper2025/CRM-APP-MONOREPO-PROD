import { useQuery } from '@tanstack/react-query';
import { Building, MapPin, Calendar, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Badge } from '@/ui/components/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { Separator } from '@/ui/components/separator';
import { LoadingSpinner } from '@/ui/components/loading';
import { Grid } from '@/ui/layout/Grid';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
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
    queryFn: () => locationsService.getPincodesByCity(city.id.toString()),
    enabled: open,
  });

  const pincodes = pincodesData?.data || [];
  const details = [
    { icon: Building, label: 'City Name', value: city.name },
    { icon: MapPin, label: 'State', value: <Badge variant="outline">{city.state}</Badge> },
    { icon: Globe, label: 'Country', value: city.country },
    { icon: Calendar, label: 'Created', value: new Date(city.createdAt).toLocaleDateString() },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 600px)' }}>
        <DialogHeader>
          <Stack direction="horizontal" gap={2} align="center">
            <Building size={20} />
            <DialogTitle>{city.name}</DialogTitle>
          </Stack>
          <DialogDescription>
            Detailed information about this city and its pincodes
          </DialogDescription>
        </DialogHeader>

        <Stack gap={5}>
          <Card>
            <CardHeader>
              <CardTitle>City Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Grid min={220}>
                {details.map((item) => (
                  <Card key={item.label} tone="muted" staticCard>
                    <Stack gap={2}>
                      <Stack direction="horizontal" gap={2} align="center">
                        <item.icon size={16} style={{ color: 'var(--ui-text-soft)' }} />
                        <Text variant="label" tone="muted">{item.label}</Text>
                      </Stack>
                      {typeof item.value === 'string' ? <Text>{item.value}</Text> : item.value}
                    </Stack>
                  </Card>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Separator style={{ marginBlock: '0.25rem' }} />

          <Card>
            <CardHeader>
              <Stack direction="horizontal" align="center" justify="space-between" gap={3} wrap="wrap">
                <CardTitle>Associated Pincodes</CardTitle>
                <Badge variant="secondary">{pincodes.length} pincodes</Badge>
              </Stack>
              <CardDescription>
                All postal codes associated with this city
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Stack align="center" justify="center" style={{ minHeight: '8rem' }}>
                  <LoadingSpinner size="md" />
                </Stack>
              ) : pincodes.length > 0 ? (
                <Stack gap={3}>
                  {pincodes.map((pincode) => (
                    <Card key={pincode.id} tone="muted" staticCard>
                      <Stack direction="horizontal" gap={3} align="center" justify="space-between" wrap="wrap">
                        <Stack direction="horizontal" gap={3} align="center">
                          <Box
                            style={{
                              width: '2rem',
                              height: '2rem',
                              borderRadius: '999px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'color-mix(in srgb, var(--ui-accent) 12%, transparent)',
                              color: 'var(--ui-accent)',
                            }}
                          >
                            <MapPin size={16} />
                          </Box>
                          <Stack gap={1}>
                            <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                            <Badge variant="outline" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                              {pincode.code}
                            </Badge>
                            <Text variant="label">{pincode.area}</Text>
                          </Stack>
                          <Text variant="body-sm" tone="muted">
                            Created {new Date(pincode.createdAt).toLocaleDateString()}
                          </Text>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                  <MapPin size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.6 }} />
                  <Text variant="title">No pincodes found</Text>
                  <Text tone="muted">
                    This city doesn&apos;t have any pincodes assigned yet.
                  </Text>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
