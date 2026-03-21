import { useQuery } from '@tanstack/react-query';
import { MapPin, Building, Calendar, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import { Badge } from '@/ui/components/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { LoadingSpinner } from '@/ui/components/Loading';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
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
  const details = [
    { label: 'State Name', icon: MapPin, value: state.name },
    { label: 'State Code', icon: MapPin, value: <Badge variant="outline">{state.code}</Badge> },
    { label: 'Country', icon: Globe, value: state.country },
    { label: 'Created', icon: Calendar, value: new Date(state.createdAt).toLocaleDateString() },
  ];
  const stats = [
    ['Cities', cities.length],
    ['Pincodes', cities.reduce((total, city) => total + (city.pincodes?.length || 0), 0)],
    ['Days Old', Math.round((Date.now() - new Date(state.createdAt).getTime()) / (1000 * 60 * 60 * 24))],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 600px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <DialogHeader>
          <Stack direction="horizontal" gap={2} align="center">
            <MapPin size={20} />
            <DialogTitle>{state.name}</DialogTitle>
          </Stack>
          <DialogDescription>
            Detailed information about {state.name} state
          </DialogDescription>
        </DialogHeader>

        <Stack gap={5}>
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
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

          <Card>
            <CardHeader>
              <Stack direction="horizontal" gap={2} align="center">
                <Building size={20} />
                <CardTitle>Cities</CardTitle>
                <Badge variant="secondary">{cities.length}</Badge>
              </Stack>
              <CardDescription>
                Cities located in {state.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {citiesLoading ? (
                <Stack align="center" justify="center" style={{ minHeight: '8rem' }}>
                  <LoadingSpinner size="md" />
                </Stack>
              ) : cities.length > 0 ? (
                <Stack gap={2}>
                  {cities.map((city) => (
                    <Card key={city.id} tone="muted" staticCard>
                      <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
                        <Stack gap={1}>
                          <Text variant="label">{city.name}</Text>
                          <Text variant="body-sm" tone="muted">
                          {city.pincodes?.length || 0} pincodes
                          </Text>
                        </Stack>
                        <Badge variant="secondary">{new Date(city.createdAt).toLocaleDateString()}</Badge>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Stack gap={2} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
                  <Building size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.6 }} />
                  <Text variant="label">No cities found</Text>
                  <Text variant="body-sm" tone="muted">
                    No cities have been added to this state yet.
                  </Text>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <Grid min={160}>
                {stats.map(([label, value]) => (
                  <Card key={label} tone="highlight" staticCard>
                    <Stack gap={1} align="center" style={{ textAlign: 'center' }}>
                      <Text variant="headline" tone="accent">{value}</Text>
                      <Text variant="body-sm" tone="muted">{label}</Text>
                    </Stack>
                  </Card>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
