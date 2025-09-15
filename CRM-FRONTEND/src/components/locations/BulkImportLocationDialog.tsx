import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import toast from 'react-hot-toast';
import { locationsService } from '@/services/locations';

interface BulkImportLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'countries' | 'states' | 'cities' | 'pincodes';
}

export function BulkImportLocationDialog({ open, onOpenChange, type }: BulkImportLocationDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
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
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: [type] });
      if (type === 'pincodes') {
        queryClient.invalidateQueries({ queryKey: ['cities'] });
      }
      toast.success(`${type} imported successfully`);
    },
    onError: (error: any) => {
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
    if (!selectedFile) return;
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>{instructions.title}</span>
          </DialogTitle>
          <DialogDescription>
            {instructions.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Format:</strong> {instructions.format}</p>
                <p><strong>Example:</strong> {instructions.example}</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="p-0 h-auto"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download template
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          {/* File Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select CSV File</label>
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="flex-1 text-sm"
                disabled={importMutation.isPending}
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing {type}...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Results */}
          {importResult && (
            <Alert className={importResult.success ? 'border-green-200' : 'border-red-200'}>
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">
                    {importResult.success ? 'Import Successful' : 'Import Failed'}
                  </p>
                  {importResult.imported && (
                    <p>Successfully imported: {importResult.imported} {type}</p>
                  )}
                  {importResult.failed && (
                    <p>Failed to import: {importResult.failed} {type}</p>
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Errors:</p>
                      <ul className="text-sm list-disc list-inside">
                        {importResult.errors.slice(0, 5).map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>... and {importResult.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
            >
              {importMutation.isPending ? 'Importing...' : `Import ${type}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
