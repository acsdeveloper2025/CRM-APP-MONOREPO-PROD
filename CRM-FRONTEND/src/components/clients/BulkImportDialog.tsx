import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/Dialog';
import { Input } from '@/ui/components/Input';
import { Label } from '@/ui/components/Label';
import { Alert, AlertDescription } from '@/ui/components/Alert';
import { Progress } from '@/ui/components/Progress';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { toast } from 'sonner';
import { clientsService } from '@/services/clients';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'clients' | 'products';
}

export function BulkImportDialog({ open, onOpenChange, type }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (type === 'clients') {
        return clientsService.bulkImportClients(file);
      } else {
        return clientsService.bulkImportProducts(file);
      }
    },
    onSuccess: (_response) => {
      queryClient.invalidateQueries({ queryKey: [type] });
      toast.success(`${type} imported successfully`);
      setFile(null);
      setUploadProgress(0);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error.response as { data?: { message?: string } })?.data?.message
        : undefined;
      toast.error(message || `Failed to import ${type}`);
      setUploadProgress(0);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = () => {
    if (!file) {
      toast.error('Please select a file to import');
      return;
    }
    
    setUploadProgress(10);
    importMutation.mutate(file);
  };

  const downloadTemplate = () => {
    // In a real implementation, this would download a CSV template
    const templateData = type === 'clients' 
      ? 'name,code\nExample Client,EXAMPLE_CLIENT'
      : 'name,clientId\nExample Product,client-id-here';
    
    const blob = new Blob([templateData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ width: 'min(95vw, 500px)' }}>
        <DialogHeader>
          <Stack direction="horizontal" gap={2} align="center">
            <Upload size={20} />
            <DialogTitle>Bulk Import {type === 'clients' ? 'Clients' : 'Products'}</DialogTitle>
          </Stack>
          <DialogDescription>
            Import multiple {type} from a CSV file. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <Stack gap={4}>
          <CardLike>
            <Stack direction="horizontal" align="center" justify="space-between" gap={3} wrap="wrap">
              <Stack direction="horizontal" gap={2} align="center">
                <FileText size={16} style={{ color: 'var(--ui-text-soft)' }} />
                <Text variant="body-sm">Download CSV template</Text>
              </Stack>
              <Button variant="outline" onClick={downloadTemplate} icon={<Download size={16} />}>
              Template
              </Button>
            </Stack>
          </CardLike>

          <Stack gap={2}>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importMutation.isPending}
            />
            {file && (
              <Text variant="body-sm" tone="muted">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </Text>
            )}
          </Stack>

          {importMutation.isPending && (
            <Stack gap={2}>
              <Progress value={uploadProgress} />
              <Text variant="body-sm" tone="muted" style={{ textAlign: 'center' }}>
                Importing {type}...
              </Text>
            </Stack>
          )}

          <Alert>
            <AlertCircle size={16} />
            <AlertDescription>
              {type === 'clients' 
                ? 'CSV should contain columns: name, code. Client codes must be unique.'
                : 'CSV should contain columns: name, clientId. Make sure client IDs exist in the system.'
              }
            </AlertDescription>
          </Alert>
        </Stack>

        <DialogFooter style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            fullWidth
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            fullWidth>
            {importMutation.isPending ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardLike({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        padding: '1rem',
        border: '1px solid var(--ui-border)',
        borderRadius: 'var(--ui-radius-lg)',
      }}
    >
      {children}
    </Box>
  );
}
