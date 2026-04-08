import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText, Search, Upload, X, ChevronDown, Check,
} from 'lucide-react';
import { useKYCDocumentTypes } from '@/hooks/useKYC';
import type { KYCCustomField } from '@/services/kyc';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';

export interface KYCDocumentSelection {
  documentTypeCode: string;
  documentTypeName: string;
  documentCategory: string;
  documentNumber?: string;
  documentHolderName?: string;
  documentDetails: Record<string, string>;
  description?: string;
  file?: File;
  assignedTo?: string;
}

interface KYCDocumentSelectorProps {
  selectedDocuments: KYCDocumentSelection[];
  onChange: (documents: KYCDocumentSelection[]) => void;
  customerName?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  IDENTITY: 'Identity',
  FINANCIAL: 'Financial',
  BUSINESS: 'Business',
  ADDRESS: 'Address',
  PROPERTY: 'Property',
  LEGAL: 'Legal',
  VERIFICATION: 'Verification',
  MEDICAL: 'Medical',
  OTHER: 'Other',
};

export const KYCDocumentSelector: React.FC<KYCDocumentSelectorProps> = ({
  selectedDocuments,
  onChange,
  customerName,
}) => {
  const { data: documentTypes = [] } = useKYCDocumentTypes();
  const { data: kycUsers = [] } = useQuery({
    queryKey: ['users-for-kyc-assign'],
    queryFn: async () => {
      const res = await apiService.get('/users', { limit: 200, isActive: 'true', role: 'KYC_VERIFIER' });
      return res.data as Array<{ id: string; name: string; employeeId: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSelected = (code: string) => selectedDocuments.some(d => d.documentTypeCode === code);

  const toggleDocument = (code: string) => {
    if (isSelected(code)) {
      onChange(selectedDocuments.filter(d => d.documentTypeCode !== code));
    } else {
      const docType = documentTypes.find(dt => dt.code === code);
      if (!docType) {return;}
      onChange([
        ...selectedDocuments,
        {
          documentTypeCode: docType.code,
          documentTypeName: docType.name,
          documentCategory: docType.category,
          documentHolderName: customerName || '',
          documentDetails: {},
        },
      ]);
    }
  };

  const removeDocument = (code: string) => {
    onChange(selectedDocuments.filter(d => d.documentTypeCode !== code));
  };

  const updateDocField = (code: string, field: keyof KYCDocumentSelection, value: string) => {
    onChange(
      selectedDocuments.map(d =>
        d.documentTypeCode === code ? { ...d, [field]: value } : d
      )
    );
  };

  const updateCustomField = (code: string, fieldKey: string, value: string) => {
    onChange(
      selectedDocuments.map(d =>
        d.documentTypeCode === code
          ? { ...d, documentDetails: { ...d.documentDetails, [fieldKey]: value } }
          : d
      )
    );
  };

  const updateFile = (code: string, file: File | undefined) => {
    onChange(
      selectedDocuments.map(d =>
        d.documentTypeCode === code ? { ...d, file } : d
      )
    );
  };

  // Filter by search term
  const filteredTypes = searchTerm.trim()
    ? documentTypes.filter(dt =>
        dt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dt.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (CATEGORY_LABELS[dt.category] || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : documentTypes;

  if (documentTypes.length === 0) {return null;}

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-600" />
          KYC Document Verification
          {selectedDocuments.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {selectedDocuments.length} selected
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Select document types for KYC verification</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropdown multi-select */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => { setDropdownOpen(!dropdownOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="w-full flex items-center justify-between border rounded-md px-3 py-2 bg-white hover:bg-gray-50 transition-colors text-sm min-h-[40px]"
          >
            <span className={selectedDocuments.length === 0 ? 'text-muted-foreground' : ''}>
              {selectedDocuments.length === 0
                ? 'Select KYC document types...'
                : `${selectedDocuments.length} document type${selectedDocuments.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Selected tags */}
          {selectedDocuments.length > 0 && !dropdownOpen && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedDocuments.map(doc => (
                <Badge
                  key={doc.documentTypeCode}
                  variant="secondary"
                  className="text-xs pl-2 pr-1 py-0.5 gap-1"
                >
                  {doc.documentTypeName}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeDocument(doc.documentTypeCode); }}
                    className="ml-0.5 rounded-full hover:bg-gray-300/50 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Dropdown list */}
          {dropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-72 overflow-hidden">
              {/* Search inside dropdown */}
              <div className="p-2 border-b sticky top-0 bg-white">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    ref={inputRef}
                    placeholder="Search document types..."
                    className="pl-9 h-9 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Options list */}
              <div className="overflow-y-auto max-h-56">
                {filteredTypes.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No document types found
                  </div>
                ) : (
                  filteredTypes.map(dt => {
                    const checked = isSelected(dt.code);
                    const categoryLabel = CATEGORY_LABELS[dt.category] || dt.category;
                    const customFieldCount = (dt.custom_fields || []).length;

                    return (
                      <button
                        key={dt.code}
                        type="button"
                        onClick={() => toggleDocument(dt.code)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${checked ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 ${checked ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                          {checked && <Check className="h-3 w-3" />}
                        </div>
                        <span className="flex-1">{dt.name}</span>
                        <span className="text-xs text-muted-foreground">{categoryLabel}</span>
                        {customFieldCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            {customFieldCount} field{customFieldCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected document forms */}
        {selectedDocuments.map(doc => {
          const docType = documentTypes.find(dt => dt.code === doc.documentTypeCode);
          const customFields: KYCCustomField[] = docType?.custom_fields || [];

          return (
            <div key={doc.documentTypeCode} className="border rounded-lg bg-white p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold">{doc.documentTypeName}</span>
                  <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[doc.documentCategory] || doc.documentCategory}</Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                  onClick={() => removeDocument(doc.documentTypeCode)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Custom fields from LOS */}
              {customFields.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {customFields.map(field => (
                    <div key={field.key}>
                      <Label className="text-xs text-gray-500">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      <Input
                        type={field.type === 'date' ? 'date' : 'text'}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="h-8 text-sm mt-1"
                        value={doc.documentDetails[field.key] || ''}
                        onChange={(e) => updateCustomField(doc.documentTypeCode, field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Common fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Document Number</Label>
                  <Input
                    placeholder={`Enter ${doc.documentTypeName} number`}
                    className="h-8 text-sm mt-1"
                    value={doc.documentNumber || ''}
                    onChange={(e) => updateDocField(doc.documentTypeCode, 'documentNumber', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Holder Name</Label>
                  <Input
                    placeholder="Document holder name"
                    className="h-8 text-sm mt-1"
                    value={doc.documentHolderName || ''}
                    onChange={(e) => updateDocField(doc.documentTypeCode, 'documentHolderName', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Assign To</Label>
                  <Select
                    value={doc.assignedTo || ''}
                    onValueChange={(v) => updateDocField(doc.documentTypeCode, 'assignedTo', v)}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue placeholder="Select verifier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {kycUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs text-gray-500">Description</Label>
                <Textarea
                  placeholder="Add notes..."
                  className="text-sm min-h-[50px] resize-none mt-1"
                  value={doc.description || ''}
                  onChange={(e) => updateDocField(doc.documentTypeCode, 'description', e.target.value)}
                />
              </div>

              {/* File upload */}
              <div>
                <Label className="text-xs text-gray-500">Document File</Label>
                {doc.file ? (
                  <div className="flex items-center gap-2 mt-1 p-2 bg-gray-50 rounded border text-sm">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate flex-1">{doc.file.name}</span>
                    <span className="text-gray-400 text-xs shrink-0">
                      {(doc.file.size / 1024).toFixed(0)} KB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateFile(doc.documentTypeCode, undefined)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 mt-1 p-2 bg-gray-50 rounded border border-dashed cursor-pointer hover:bg-gray-100 transition-colors text-sm text-gray-500">
                    <Upload className="h-4 w-4" />
                    <span>Click to upload</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {updateFile(doc.documentTypeCode, file);}
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
