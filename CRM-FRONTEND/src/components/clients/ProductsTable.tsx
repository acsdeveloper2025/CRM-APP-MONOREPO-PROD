import { useState } from 'react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { MoreHorizontal, Edit, Trash2, Eye, Package } from 'lucide-react';
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
import { clientsService } from '@/services/clients';
import { Product } from '@/types/product';
import { EditProductDialog } from './EditProductDialog';
import { ProductDetailsDialog } from './ProductDetailsDialog';

interface ProductsTableProps {
  data: Product[];
  isLoading: boolean;
}

export function ProductsTable({ data, isLoading }: ProductsTableProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const deleteMutation = useStandardizedMutation({
    mutationFn: (id: number) => clientsService.deleteProduct(id),
    successMessage: 'Product deleted successfully',
    errorContext: 'Product Deletion',
    errorFallbackMessage: 'Failed to delete product',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setProductToDelete(null);
    },
    onErrorCallback: () => {
      setShowDeleteDialog(false);
      setProductToDelete(null);
    },
  });

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowEditDialog(true);
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailsDialog(true);
  };

  const handleDelete = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete.id);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading products..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '3rem', textAlign: 'center' }}>
        <Package size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No products found</Text>
        <Text tone="muted">
          Get started by creating your first product.
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
              <TableHead>Product Name</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((product) => (
              <TableRow key={product.id}>
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
                      <Package size={16} />
                    </Box>
                    <Text as="span" variant="label">{product.name}</Text>
                  </Stack>
                </TableCell>
                <TableCell>
                  {new Date(product.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant="positive">Active</Badge>
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
                      <DropdownMenuItem onClick={() => handleViewDetails(product)}>
                        <Eye size={16} style={{ marginRight: '0.5rem' }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(product)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit Product
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(product)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete Product
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
      {selectedProduct && (
        <EditProductDialog
          product={selectedProduct}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Details Dialog */}
      {selectedProduct && (
        <ProductDetailsDialog
          product={selectedProduct}
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
              This action cannot be undone. This will permanently delete the product
              &quot;{productToDelete?.name}&quot; and all associated verification types.
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
