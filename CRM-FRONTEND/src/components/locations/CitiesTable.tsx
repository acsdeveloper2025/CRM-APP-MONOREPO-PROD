import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, Building, ToggleLeft, ToggleRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMutationWithInvalidation,
  useStandardizedMutation,
} from '@/hooks/useStandardizedMutation';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { baseBadgeStyle, formatBadgeLabel } from '@/lib/badgeStyles';
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
import { locationsService } from '@/services/locations';
import { City } from '@/types/location';
import { EditCityDialog } from './EditCityDialog';
import { CityDetailsDialog } from './CityDetailsDialog';

interface CitiesTableProps {
  data: City[];
  isLoading: boolean;
}

export function CitiesTable({ data, isLoading }: CitiesTableProps) {
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  const deleteMutation = useMutationWithInvalidation({
    mutationFn: (id: string) => locationsService.deleteCity(id),
    invalidateKeys: [['cities'], ['city-stats']],
    successMessage: 'City deleted successfully',
    errorContext: 'City Deletion',
    errorFallbackMessage: 'Failed to delete city',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setCityToDelete(null);
    },
  });

  const toggleActiveMutation = useStandardizedMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      locationsService.updateCity(id, { isActive }),
    errorContext: 'City Status Toggle',
    errorFallbackMessage: 'Failed to update city status',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['city-stats'] });
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
    return (
      <TableSkeleton
        headers={['City Name', 'State', 'Country', 'Created Date', 'Status', 'Actions']}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Building className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No cities found</h3>
        <p className="text-muted-foreground">Get started by adding your first city.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>City Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((city) => (
              <TableRow key={city.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building className="h-4 w-4 text-primary" />
                    </div>
                    <span>{city.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{formatBadgeLabel(city.state)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={baseBadgeStyle}>{formatBadgeLabel(city.country)}</Badge>
                </TableCell>
                <TableCell>{new Date(city.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {city.isActive === false ? (
                    <Badge variant="secondary">INACTIVE</Badge>
                  ) : (
                    <Badge variant="default">ACTIVE</Badge>
                  )}
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
                      <DropdownMenuItem onClick={() => handleViewDetails(city)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(city)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit City
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={toggleActiveMutation.isPending}
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: String(city.id),
                            isActive: !(city.isActive ?? true),
                          })
                        }
                      >
                        {city.isActive === false ? (
                          <>
                            <ToggleRight className="mr-2 h-4 w-4" />
                            Activate
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="mr-2 h-4 w-4" />
                            Deactivate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(city)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete City
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedCity && (
        <EditCityDialog
          city={selectedCity}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {selectedCity && (
        <CityDetailsDialog
          city={selectedCity}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the city &quot;
              {cityToDelete?.name}&quot; and all associated pincodes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
