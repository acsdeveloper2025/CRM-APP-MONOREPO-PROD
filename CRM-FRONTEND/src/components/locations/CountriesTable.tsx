import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, Globe } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/AlertDialog';
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
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { locationsService } from '@/services/locations';
import { EditCountryDialog } from './EditCountryDialog';
import { CountryDetailsDialog } from './CountryDetailsDialog';
import type { Country } from '@/types/location';

interface CountriesTableProps {
  data: Country[];
  isLoading: boolean;
}

export function CountriesTable({ data, isLoading }: CountriesTableProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);

  const deleteCountryMutation = useMutationWithInvalidation({
    mutationFn: (id: number) => locationsService.deleteCountry(id.toString()),
    invalidateKeys: [['countries']],
    successMessage: 'Country deleted successfully',
    errorContext: 'Country Deletion',
    errorFallbackMessage: 'Failed to delete country',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setCountryToDelete(null);
    },
  });

  const handleEdit = (country: Country) => {
    setSelectedCountry(country);
    setShowEditDialog(true);
  };

  const handleView = (country: Country) => {
    setSelectedCountry(country);
    setShowDetailsDialog(true);
  };

  const handleDelete = (country: Country) => {
    setCountryToDelete(country);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (countryToDelete) {
      deleteCountryMutation.mutate(countryToDelete.id);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading countries..." size="lg" />;
  }

  if (!data.length) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '2rem', textAlign: 'center' }}>
        <Globe size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No countries found</Text>
        <Text tone="muted">
          Get started by creating a new country.
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
              <TableHead>Country</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Continent</TableHead>
              <TableHead>Created</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((country) => (
              <TableRow key={country.id}>
                <TableCell style={{ fontWeight: 600 }}>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Globe size={16} style={{ color: 'var(--ui-text-soft)' }} />
                    <Text as="span" variant="label">{country.name}</Text>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatBadgeLabel(country.code)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatBadgeLabel(country.continent)}</Badge>
                </TableCell>
                <TableCell>
                  <Text as="span" variant="body-sm" tone="muted">
                  {new Date(country.createdAt).toLocaleDateString()}
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
                      <DropdownMenuItem onClick={() => handleView(country)}>
                        <Eye size={16} style={{ marginRight: '0.5rem' }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(country)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(country)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Dialogs */}
      {selectedCountry && (
        <>
          <EditCountryDialog
            country={selectedCountry}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
          />
          <CountryDetailsDialog
            country={selectedCountry}
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the country
              &quot;{countryToDelete?.name}&quot; and all associated states.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ background: 'var(--ui-danger)', color: 'white' }}
              disabled={deleteCountryMutation.isPending}
            >
              {deleteCountryMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
