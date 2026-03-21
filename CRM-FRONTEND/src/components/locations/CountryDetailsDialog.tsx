
import { useQuery } from '@tanstack/react-query';
import { Globe, MapPin, Building, Calendar, Hash } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Badge } from '@/ui/components/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/Card';
import { LoadingSpinner } from '@/ui/components/loading';
import { Grid } from '@/ui/layout/Grid';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
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
  const stats = [
    ['States', states.length],
    ['Cities', states.reduce((acc, state) => acc + (state.cities?.length || 0), 0)],
    ['Continent', country.continent],
  ];
  const details = [
    { icon: Globe, label: 'Country Name', value: country.name },
    { icon: Hash, label: 'Country Code', value: <Badge variant="outline">{country.code}</Badge> },
    { icon: MapPin, label: 'Continent', value: <Badge variant="accent">{country.continent}</Badge> },
    {
      icon: Calendar,
      label: 'Created',
      value: new Date(country.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 600px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <DialogHeader>
          <Stack direction="horizontal" gap={2} align="center">
            <Globe size={20} />
            <DialogTitle>{country.name}</DialogTitle>
          </Stack>
          <DialogDescription>
            Country details and associated states
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
                <CardTitle>Associated States</CardTitle>
                <Badge variant="secondary">{states.length}</Badge>
              </Stack>
              <CardDescription>
                States and territories within this country
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statesLoading ? (
                <Stack align="center" justify="center" style={{ minHeight: '8rem' }}>
                  <LoadingSpinner size="md" />
                </Stack>
              ) : states.length > 0 ? (
                <Stack gap={2}>
                  {states.map((state) => (
                    <Card key={state.id} tone="muted" staticCard>
                      <Stack direction="horizontal" justify="space-between" align="center" gap={3} wrap="wrap">
                        <Stack direction="horizontal" gap={2} align="center">
                          <MapPin size={16} style={{ color: 'var(--ui-text-soft)' }} />
                          <Stack gap={1}>
                            <Text variant="label">{state.name}</Text>
                            <Text variant="body-sm" tone="muted">Code: {state.code}</Text>
                          </Stack>
                        </Stack>
                        <Text variant="body-sm" tone="muted">
                          {new Date(state.createdAt).toLocaleDateString()}
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Stack gap={2} align="center" style={{ paddingBlock: '1.5rem', textAlign: 'center' }}>
                  <Building size={32} style={{ color: 'var(--ui-text-soft)', opacity: 0.6 }} />
                  <Text tone="muted">No states found for this country</Text>
                  <Text variant="body-sm" tone="soft">States will appear here when created</Text>
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
