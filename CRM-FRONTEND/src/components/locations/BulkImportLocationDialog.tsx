import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Alert, AlertDescription } from '@/ui/components/alert';
import { Progress } from '@/ui/components/progress';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { toast } from 'sonner';
import { locationsService } from '@/services/locations';
import { ApiErrorResponse } from '@/types/api';

interface ImportResult {
  success: boolean;
  message?: string;
  imported?: number;
  failed?: number;
  errors?: string[];
}

interface BulkImportLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'countries' | 'states' | 'cities' | 'pincodes';
}

export function BulkImportLocationDialog({ open, onOpenChange, type }: BulkImportLocationDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      if (type === 'countries') {
        return locationsService.bulkImportCountries(file);
      } else if (type === 'states') {
        return locationsService.bulkImportStates(file);
      } else if (type === 'cities') {
        return locationsService.bulkImportCities(file);
      } else {
        return locationsService.bulkImportPincodes(file);
      }
    },
    onSuccess: (result) => {
      // Cast the result to unknown first, then to ImportResult to satisfy TypeScript
      // This assumes the API returns the result structure matching ImportResult
      setImportResult(result as unknown as ImportResult);
      queryClient.invalidateQueries({ queryKey: [type] });
      if (type === 'pincodes') {
        queryClient.invalidateQueries({ queryKey: ['cities'] });
      }
      toast.success(`${type} imported successfully`);
    },
    onError: (error: ApiErrorResponse) => {
      toast.error(error.response?.data?.message || `Failed to import ${type}`);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile) {return;}
    importMutation.mutate(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const csvContent = type === 'cities' 
      ? 'name,state,country\nMumbai,Maharashtra,India\nDelhi,Delhi,India'
      : 'code,area,cityName,state,country\n400001,Fort,Mumbai,Maharashtra,India\n110001,Connaught Place,Delhi,Delhi,India';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const getInstructions = () => {
    if (type === 'cities') {
      return {
        title: 'Import Cities',
        description: 'Upload a CSV file to bulk import cities',
        format: 'CSV format: name, state, country',
        example: 'Mumbai, Maharashtra, India'
      };
    } else {
      return {
        title: 'Import Pincodes',
        description: 'Upload a CSV file to bulk import pincodes',
        format: 'CSV format: code, area, cityName, state, country',
        example: '400001, Fort, Mumbai, Maharashtra, India'
      };
    }
  };

  const instructions = getInstructions();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent style={{ width: 'min(95vw, 500px)' }}>
        <DialogHeader>
          <DialogTitle>
            <Stack direction="horizontal" gap={2} align="center">
              <Upload size={20} />
              <Text as="span" variant="title">{instructions.title}</Text>
            </Stack>
          </DialogTitle>
          <DialogDescription>
            {instructions.description}
          </DialogDescription>
        </DialogHeader>

        <Stack gap={4}>
          {/* Instructions */}
          <Alert>
            <FileText size={16} />
            <AlertDescription>
              <Stack gap={2}>
                <Text><strong>Format:</strong> {instructions.format}</Text>
                <Text><strong>Example:</strong> {instructions.example}</Text>
                <Button
                  variant="ghost"
                  onClick={handleDownloadTemplate}
                  icon={<Download size={14} />}
                  style={{ padding: 0, justifyContent: 'flex-start' }}
                >
                  Download template
                </Button>
              </Stack>
            </AlertDescription>
          </Alert>

          {/* File Selection */}
          <Stack gap={2}>
            <Text as="label" variant="label">Select CSV File</Text>
            <Box style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ flex: 1, fontSize: '0.875rem' }}
                disabled={importMutation.isPending}
              />
            </Box>
            {selectedFile && (
              <Text variant="body-sm" tone="muted">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </Text>
            )}
          </Stack>

          {/* Progress */}
          {importMutation.isPending && (
            <Stack gap={2}>
              <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <Text as="span" variant="body-sm">Importing {type}...</Text>
                <Text as="span" variant="body-sm">{uploadProgress}%</Text>
              </Box>
              <Progress value={uploadProgress} />
            </Stack>
          )}

          {/* Results */}
          {importResult && (
            <Alert style={{ borderColor: importResult.success ? 'var(--ui-success)' : 'var(--ui-danger)' }}>
              {importResult.success ? (
                <CheckCircle size={16} style={{ color: 'var(--ui-success)' }} />
              ) : (
                <AlertCircle size={16} style={{ color: 'var(--ui-danger)' }} />
              )}
              <AlertDescription>
                <Stack gap={1}>
                  <Text style={{ fontWeight: 600 }}>
                    {importResult.success ? 'Import Successful' : 'Import Failed'}
                  </Text>
                  {importResult.imported && (
                    <Text>Successfully imported: {importResult.imported} {type}</Text>
                  )}
                  {importResult.failed && (
                    <Text>Failed to import: {importResult.failed} {type}</Text>
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <Stack gap={1} style={{ marginTop: '0.5rem' }}>
                      <Text variant="body-sm" style={{ fontWeight: 600 }}>Errors:</Text>
                      <Box as="ul" style={{ fontSize: '0.875rem', paddingLeft: '1.25rem', margin: 0 }}>
                        {importResult.errors.slice(0, 5).map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>... and {importResult.errors.length - 5} more errors</li>
                        )}
                      </Box>
                    </Stack>
                  )}
                </Stack>
              </AlertDescription>
            </Alert>
          )}
        </Stack>

        <DialogFooter style={{ display: 'flex', gap: 'var(--ui-gap-2)', flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={handleClose} fullWidth>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
              fullWidth>
              {importMutation.isPending ? 'Importing...' : `Import ${type}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
