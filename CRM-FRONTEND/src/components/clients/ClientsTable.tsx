import { useState } from 'react';
import { useStandardizedMutation } from '@/hooks/useStandardizedMutation';
import { MoreHorizontal, Edit, Trash2, Eye, Building2 } from 'lucide-react';
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
} from '@/ui/components/AlertDialog';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { clientsService } from '@/services/clients';
import { Client } from '@/types/client';
import { EditClientDialog } from './EditClientDialog';
import { ClientDetailsDialog } from './ClientDetailsDialog';

interface ClientsTableProps {
  data: Client[];
  isLoading: boolean;
}

export function ClientsTable({ data, isLoading }: ClientsTableProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const deleteMutation = useStandardizedMutation({
    mutationFn: (id: number) => clientsService.deleteClient(id),
    successMessage: 'Client deleted successfully',
    errorContext: 'Client Deletion',
    errorFallbackMessage: 'Failed to delete client',
    onSuccess: () => {
      setShowDeleteDialog(false);
      setClientToDelete(null);
    },
    onErrorCallback: () => {
      setShowDeleteDialog(false);
      setClientToDelete(null);
    },
  });

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setShowEditDialog(true);
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setShowDetailsDialog(true);
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteMutation.mutate(clientToDelete.id);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading clients..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <Stack gap={3} align="center" style={{ paddingBlock: '3rem', textAlign: 'center' }}>
        <Building2 size={48} style={{ color: 'var(--ui-text-soft)', opacity: 0.75 }} />
        <Text as="h3" variant="title">No clients found</Text>
        <Text tone="muted">
          Get started by creating your first client.
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
              <TableHead>Client Name</TableHead>
              <TableHead>Client Code</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Verification Types</TableHead>
              <TableHead>Document Types</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((client) => (
              <TableRow key={client.id}>
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
                      <Building2 size={16} />
                    </Box>
                    <Text as="span" variant="label">{client.name}</Text>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                  >
                    {formatBadgeLabel(client.code)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Stack direction="horizontal" gap={1} wrap="wrap">
                    {client.products && client.products.length > 0 ? (
                      <>
                        {client.products.slice(0, 2).map((p) => (
                          <Badge key={p.id} variant="outline">
                            {p.code}
                          </Badge>
                        ))}
                        {client.products.length > 2 && (
                          <Badge variant="secondary">
                            +{client.products.length - 2}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Text as="span" variant="body-sm" tone="soft">-</Text>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="horizontal" gap={1} wrap="wrap">
                    {client.verificationTypes && client.verificationTypes.length > 0 ? (
                      <>
                        {client.verificationTypes.slice(0, 2).map((vt) => (
                          <Badge key={vt.id} variant="outline">
                            {vt.code}
                          </Badge>
                        ))}
                        {client.verificationTypes.length > 2 && (
                          <Badge variant="secondary">
                            +{client.verificationTypes.length - 2}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Text as="span" variant="body-sm" tone="soft">-</Text>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="horizontal" gap={1} wrap="wrap">
                    {client.documentTypes && client.documentTypes.length > 0 ? (
                      <>
                        {client.documentTypes.slice(0, 2).map((dt) => (
                          <Badge key={dt.id} variant="outline">
                            {dt.code}
                          </Badge>
                        ))}
                        {client.documentTypes.length > 2 && (
                          <Badge variant="secondary">
                            +{client.documentTypes.length - 2}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Text as="span" variant="body-sm" tone="soft">-</Text>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  {new Date(client.createdAt).toLocaleDateString()}
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
                      <DropdownMenuItem onClick={() => handleViewDetails(client)}>
                        <Eye size={16} style={{ marginRight: '0.5rem' }} />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(client)}>
                        <Edit size={16} style={{ marginRight: '0.5rem' }} />
                        Edit Client
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(client)}
                        style={{ color: 'var(--ui-danger)' }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Delete Client
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
      {selectedClient && (
        <EditClientDialog
          client={selectedClient}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Details Dialog */}
      {selectedClient && (
        <ClientDetailsDialog
          client={selectedClient}
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
              This action cannot be undone. This will permanently delete the client
              &quot;{clientToDelete?.name}&quot; and all associated data.
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
