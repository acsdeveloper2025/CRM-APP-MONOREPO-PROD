import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, Globe } from 'lucide-react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
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

  const deleteCountryMutation = useStandardizedMutation({
    mutationFn: (id: string) => locationsService.deleteCountry(id),
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
      <div className="text-center py-8">
        <Globe className="mx-auto h-12 w-12 text-gray-600" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No countries found</h3>
        <p className="mt-1 text-sm text-gray-600">
          Get started by creating a new country.
        </p>
      </div>
    );
  }



  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Continent</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((country) => (
              <TableRow key={country.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-gray-600" />
                    <span>{country.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{formatBadgeLabel(country.code)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{formatBadgeLabel(country.continent)}</Badge>
                </TableCell>
                <TableCell className="text-gray-600">
                  {new Date(country.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleView(country)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(country)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(country)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
