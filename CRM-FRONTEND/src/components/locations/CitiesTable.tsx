import { useState } from 'react';
import { MoreHorizontal, Edit, Trash2, Eye, Building, MapPin } from 'lucide-react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
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
import { LoadingState } from '@/components/ui/loading';
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
      <div className="text-center py-12">
        <Building className="mx-auto h-12 w-12 text-gray-600" />
        <h3 className="mt-4 text-lg font-semibold">No cities found</h3>
        <p className="text-gray-600">
          Get started by adding your first city.
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
              <TableHead>City Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Pincodes</TableHead>
              <TableHead>Created Date</TableHead>
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
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-3 w-3 text-gray-600" />
                    <span className="text-sm text-gray-600">
                      {city.pincodeCount || 0} pincodes
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(city.createdAt).toLocaleDateString()}
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
