import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, Building } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/ui/components/Button';
import { Badge } from '@/ui/components/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/DropdownMenu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/Table';
import { LoadingState } from '@/ui/components/Loading';
import { formatBadgeLabel } from '@/lib/badgeStyles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/AlertDialog';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { City } from '@/types/location';
import { EditCityDialog } from './EditCityDialog';
import { CityDetailsDialog } from './CityDetailsDialog';

interface CitiesTableProps {
  data: City[];
  isLoading: boolean;
}

export function CitiesTable({ data, isLoading }: CitiesTableProps) {
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deleteCity(id),
    invalidateKeys: [['cities']],
    successMessage: 'City deleted successfully',
    errorContext: 'City Deletion',
    errorFallbackMessage: 'Failed to delete city',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setCityToDelete(null);
    },
  });

  const handleEdit = (city: City) => {
    setSelectedCity(city);
    setShowEditDialog(true);
  };

  const handleViewDetails = (city: City) => {
    setSelectedCity(city);
    setShowDetailsDialog(true);
  };

  const handleDelete = (city: City) => {
    setCityToDelete(city);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (cityToDelete) {
      deleteMutation.mutate(String(cityToDelete.id));
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading cities..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '3rem', textAlign: 'center' }}>
        <Building size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No cities found</Text>
        <Text tone="muted">
          Get started by adding your first city.
        </Text>
      </Stack>
    );
  }

  return (
    <>
      <Box style={{ overflowX: 'auto', border: '1px solid var(--ui-border)', borderRadius: 'var(--ui-radius-lg)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((city) => (
              <TableRow key={city.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  <Stack direction="horizontal" gap={2} align="center">
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
                      <Building size={16} />
                    </Box>
                    <Text as="span" variant="label">{city.name}</Text>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatBadgeLabel(city.state)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatBadgeLabel(city.country)}</Badge>
                </TableCell>
                <TableCell>
                  <Text as="span" variant="body-sm" tone="muted">
                    {new Date(city.createdAt).toLocaleDateString()}
                  </Text>
                </TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" aria-label="Open actions menu">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleViewDetails(city)}>
                        <Eye size={16} style={{ marginRight: '0.5rem' }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(city)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit City
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(city)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete City
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Edit Dialog */}
      {selectedCity && (
        <EditCityDialog
          city={selectedCity}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Details Dialog */}
      {selectedCity && (
        <CityDetailsDialog
          city={selectedCity}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the city
              &quot;{cityToDelete?.name}&quot; and all associated pincodes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ background: 'var(--ui-danger)', color: 'white' }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
