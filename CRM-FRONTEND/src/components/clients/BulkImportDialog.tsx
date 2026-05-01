import React, { useState } from 'react';
import { useMutationWithInvalidation } from '@/hooks/useStandardizedMutation';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
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

  const importMutation = useMutationWithInvalidation({
    mutationFn: async (file: File) => {
      if (type === 'clients') {
        return clientsService.bulkImportClients(file);
      } else {
        return clientsService.bulkImportProducts(file);
      }
    },
    invalidateKeys: [[type]],
    successMessage: `${type} imported successfully`,
    errorContext: `Bulk Import (${type})`,
    errorFallbackMessage: `Failed to import ${type}`,
    onSuccess: () => {
      setFile(null);
      setUploadProgress(0);
      onOpenChange(false);
    },
    onErrorCallback: () => setUploadProgress(0),
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
    // Templates match the backend bulk-import controllers. Required cols
    // are first; optional cols follow. clientCodes on products takes a
    // semicolon-separated list (e.g. ACME;FOO).
    const templateData =
      type === 'clients'
        ? 'name,code,email,phone,address,gstin,pan,gstinStateCode,billingAddressLine1,billingAddressLine2,billingPincode,billingCity,billingState,billingCountry,tier,isActive\nExample Client,EXAMPLE_CLIENT,ops@example.com,9999999999,,27ABCDE1234F1Z5,ABCDE1234F,27,Office #1,Marol,400059,Mumbai,Maharashtra,India,STARTER,true'
        : 'name,code,description,isActive,clientCodes\nExample Product,EXAMPLE_PRODUCT,Demo product,true,EXAMPLE_CLIENT';

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
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Bulk Import {type === 'clients' ? 'Clients' : 'Products'}</span>
          </DialogTitle>
          <DialogDescription>
            Import multiple {type} from a CSV file. Download the template to see the required
            format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <span className="text-sm">Download CSV template</span>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={importMutation.isPending}
            />
            {file && (
              <p className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-gray-600 text-center">Importing {type}...</p>
            </div>
          )}

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {type === 'clients'
                ? 'Required: name, code (unique). Optional: email, phone, address, gstin, pan, gstinStateCode, billingAddressLine1/2, billingPincode, billingCity, billingState, billingCountry, tier (STARTER|GROWTH|ENTERPRISE), isActive. Country/state/city must already exist.'
                : 'Required: name, code (unique). Optional: description, isActive, clientCodes (semicolon-separated, e.g. ACME;FOO; replaces existing client mapping when provided).'}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            className="w-full sm:w-auto"
          >
            {importMutation.isPending ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
