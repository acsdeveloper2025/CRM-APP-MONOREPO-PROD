import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Send, Loader2, User, MapPin, Building2, CreditCard, Building, Users, Settings } from 'lucide-react';
import { useFieldUsers } from '@/hooks/useUsers';
import { useClients, useVerificationTypes, useProductsByClient } from '@/hooks/useClients';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useAuth } from '@/contexts/AuthContext';
import { CaseFormAttachmentsSection, type CaseFormAttachment } from '@/components/attachments/CaseFormAttachmentsSection';
import type { CustomerInfoData } from './CustomerInfoStep';
import { rateTypesService } from '@/services/rateTypes';
import { useQuery } from '@tanstack/react-query';

const fullCaseFormSchema = z.object({
  // Customer Information (new fields)
  applicantType: z.string().min(1, 'Applicant type is required'),
  address: z.string().min(1, 'Address is required').max(500, 'Address must be less than 500 characters'),
  trigger: z.string().min(1, 'TRIGGER is required'), // Required TRIGGER field

  // Client Information
  clientId: z.string().min(1, 'Client selection is required'),
  productId: z.string().min(1, 'Product selection is required'),
  verificationTypeId: z.string().min(1, 'Verification type is required'),

  // Assignment Information
  createdByBackendUser: z.string().min(1, 'Created by backend user is required'),
  backendContactNumber: z.string().min(1, 'Backend contact number is required').regex(/^[+]?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number'),
  pincodeId: z.string().min(1, 'Pincode selection is required'),
  areaId: z.string().min(1, 'Area selection is required'),
  assignedToId: z.string().min(1, 'Field user assignment is required'),
  priority: z.string().min(1, 'Priority is required'),
  rateTypeId: z.string().optional(),
});

export type FullCaseFormData = z.infer<typeof fullCaseFormSchema>;

interface FullCaseFormStepProps {
  customerInfo: CustomerInfoData;
  onSubmit: (data: FullCaseFormData, attachments: CaseFormAttachment[]) => void;
  onBack?: () => void;
  isSubmitting?: boolean;
  initialData?: Partial<FullCaseFormData>;
  editMode?: boolean;
}

export const FullCaseFormStep: React.FC<FullCaseFormStepProps> = ({
  customerInfo,
  onSubmit,
  onBack,
  isSubmitting = false,
  initialData = {},
  editMode = false
}) => {
  const { user } = useAuth();
  const { data: fieldUsers, isLoading: loadingUsers } = useFieldUsers();
  const { data: clientsResponse, isLoading: loadingClients } = useClients();
  const { data: verificationTypesResponse, isLoading: loadingVerificationTypes } = useVerificationTypes();

  // Helper function to get user display name
  const getUserDisplayName = (user: any) => {
    if (!user) return '';

    // Try different possible name formats
    if (user.name && typeof user.name === 'string' && user.name.trim()) {
      return user.name;
    }

    // If name is just a number/ID, try firstName + lastName
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }

    // If only firstName available
    if (user.firstName) {
      return user.firstName;
    }

    // Fallback to username if available
    if (user.username) {
      return user.username;
    }

    // Last resort - return the name even if it looks like an ID
    return user.name || 'Unknown User';
  };

  // Extract the actual arrays from the API responses (fieldUsers is already extracted by the hook)
  const clients = clientsResponse?.data || [];
  const verificationTypes = verificationTypesResponse?.data || [];

  const form = useForm<FullCaseFormData>({
    resolver: zodResolver(fullCaseFormSchema),
    defaultValues: {
      applicantType: initialData.applicantType || '',
      address: initialData.address || '',
      trigger: initialData.trigger || '', // TRIGGER field
      clientId: initialData.clientId || '',
      productId: initialData.productId || '',
      verificationTypeId: initialData.verificationTypeId || '',
      createdByBackendUser: initialData.createdByBackendUser || getUserDisplayName(user),
      backendContactNumber: initialData.backendContactNumber || '',
      pincodeId: initialData.pincodeId || '',
      areaId: initialData.areaId || '',
      assignedToId: initialData.assignedToId || '',
      priority: initialData.priority || 'MEDIUM',
      rateTypeId: initialData.rateTypeId || '',
    },
  });

  // Attachments state
  const [attachments, setAttachments] = useState<CaseFormAttachment[]>([]);

  // Watch for client selection to fetch products
  const selectedClientId = form.watch('clientId');
  const { data: productsResponse } = useProductsByClient(selectedClientId);
  const products = productsResponse?.data || [];

  // Watch for product selection to fetch verification types
  const selectedProductId = form.watch('productId');
  const selectedVerificationTypeId = form.watch('verificationTypeId');

  // Watch for pincode selection to fetch areas
  const selectedPincodeId = form.watch('pincodeId');
  const { data: pincodesResponse } = usePincodes();
  const pincodes = pincodesResponse?.data || [];
  const { data: areasResponse } = useAreasByPincode(selectedPincodeId ? parseInt(selectedPincodeId) : undefined);
  const areas = areasResponse?.data || [];

  // Fetch available rate types when client, product, and verification type are selected
  const { data: availableRateTypesResponse, isLoading: loadingRateTypes } = useQuery({
    queryKey: ['available-rate-types-for-case', selectedClientId, selectedProductId, selectedVerificationTypeId],
    queryFn: () => rateTypesService.getAvailableRateTypesForCase(
      parseInt(selectedClientId!),
      parseInt(selectedProductId!),
      parseInt(selectedVerificationTypeId!)
    ),
    enabled: !!(selectedClientId && selectedProductId && selectedVerificationTypeId),
  });
  const availableRateTypes = availableRateTypesResponse?.data || [];

  // Watch for rate type selection to show rate calculation
  const selectedRateTypeId = form.watch('rateTypeId');
  const selectedRateType = availableRateTypes.find(rt => rt.id.toString() === selectedRateTypeId);

  // Clear rate type when client, product, or verification type changes
  useEffect(() => {
    form.setValue('rateTypeId', '');
  }, [selectedClientId, selectedProductId, selectedVerificationTypeId, form]);

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (editMode && initialData && Object.keys(initialData).length > 0) {
      const formData = {
        applicantType: initialData.applicantType || '',
        address: initialData.address || '',
        trigger: initialData.trigger || '', // TRIGGER field
        clientId: initialData.clientId || '',
        productId: initialData.productId || '',
        verificationTypeId: initialData.verificationTypeId || '',
        createdByBackendUser: initialData.createdByBackendUser || getUserDisplayName(user),
        backendContactNumber: initialData.backendContactNumber || '',
        pincodeId: initialData.pincodeId || '',
        areaId: initialData.areaId || '',
        assignedToId: initialData.assignedToId || '',
        priority: initialData.priority || 'MEDIUM',
      };

      form.reset(formData);
    }
  }, [editMode, initialData, form, user]);

  // Additional useEffect to ensure form values are set when dependent data loads
  useEffect(() => {
    if (editMode && initialData && Object.keys(initialData).length > 0) {
      // Re-set productId when products are loaded
      if (products.length > 0 && initialData.productId && form.getValues('productId') !== initialData.productId) {
        form.setValue('productId', initialData.productId);
      }

      // Re-set areaId when areas are loaded
      if (areas.length > 0 && initialData.areaId && form.getValues('areaId') !== initialData.areaId) {
        form.setValue('areaId', initialData.areaId);
      }
    }
  }, [editMode, initialData, products, areas, form]);

  const handleSubmit = (data: FullCaseFormData) => {
    onSubmit(data, attachments);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Case Details</h2>
        <p className="text-muted-foreground">
          Complete the case information and assignment details
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

          {/* Customer Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
              <CardDescription>
                Customer details and additional information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Read-only customer details from previous step */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer Name *</label>
                  <p className="text-base font-medium">{customerInfo.customerName}</p>
                </div>
                {customerInfo.panNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">PAN</label>
                    <p className="text-base font-mono">{customerInfo.panNumber}</p>
                  </div>
                )}
                {customerInfo.mobileNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Mobile Number</label>
                    <p className="text-base">{customerInfo.mobileNumber}</p>
                  </div>
                )}
              </div>

              {/* Applicant Type */}
              <FormField
                control={form.control}
                name="applicantType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applicant Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select applicant type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="APPLICANT">APPLICANT</SelectItem>
                        <SelectItem value="CO-APPLICANT">CO-APPLICANT</SelectItem>
                        <SelectItem value="CO-APPLICANT 1">CO-APPLICANT 1</SelectItem>
                        <SelectItem value="CO-APPLICANT 2">CO-APPLICANT 2</SelectItem>
                        <SelectItem value="CO-APPLICANT 3">CO-APPLICANT 3</SelectItem>
                        <SelectItem value="GUARANTOR">GUARANTOR</SelectItem>
                        <SelectItem value="SELLER">SELLER</SelectItem>
                        <SelectItem value="PROPRIETOR">PROPRIETOR</SelectItem>
                        <SelectItem value="PARTNER">PARTNER</SelectItem>
                        <SelectItem value="DIRECTOR">DIRECTOR</SelectItem>
                        <SelectItem value="REFERENCE PERSON">REFERENCE PERSON</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter complete address"
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* TRIGGER */}
              <FormField
                control={form.control}
                name="trigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TRIGGER *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional information or special instructions"
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Client Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Client Information
              </CardTitle>
              <CardDescription>
                Select client, product, and verification type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Client Name */}
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        // Reset product selection when client changes
                        form.setValue('productId', '');
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingClients ? (
                            <SelectItem value="loading" disabled>Loading clients...</SelectItem>
                          ) : clients.length === 0 ? (
                            <SelectItem value="no-clients" disabled>No clients available</SelectItem>
                          ) : (
                            clients.map((client) => (
                              <SelectItem key={client.id} value={String(client.id)}>
                                {client.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Product */}
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedClientId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedClientId ? "Select product" : "Select client first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name} ({product.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Verification Type */}
                <FormField
                  control={form.control}
                  name="verificationTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select verification type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {verificationTypes?.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Assignment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Assignment
              </CardTitle>
              <CardDescription>
                Assignment details and location information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Created By Backend User */}
                <FormField
                  control={form.control}
                  name="createdByBackendUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Created By Backend User *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Backend user name"
                          disabled={true}
                          className="bg-muted text-muted-foreground"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Backend Contact Number */}
                <FormField
                  control={form.control}
                  name="backendContactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backend Contact Number *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter backend user contact number"
                          type="tel"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pincode */}
                <FormField
                  control={form.control}
                  name="pincodeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode *</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        // Reset area selection when pincode changes
                        form.setValue('areaId', '');
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pincode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pincodes?.map((pincode) => (
                            <SelectItem key={pincode.id} value={pincode.id.toString()}>
                              {pincode.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Area */}
                <FormField
                  control={form.control}
                  name="areaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPincodeId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedPincodeId ? "Select area" : "Select pincode first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {areas?.map((area) => (
                            <SelectItem key={area.id} value={area.id.toString()}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rate Type */}
                <FormField
                  control={form.control}
                  name="rateTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedClientId || !selectedProductId || !selectedVerificationTypeId || loadingRateTypes}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !selectedClientId || !selectedProductId || !selectedVerificationTypeId
                                ? "Select client, product & verification type first"
                                : loadingRateTypes
                                ? "Loading rate types..."
                                : availableRateTypes.length === 0
                                ? "No rate types available"
                                : "Select rate type"
                            }>
                              {field.value && availableRateTypes && (() => {
                                const selectedRateType = availableRateTypes.find(rt => rt.id.toString() === field.value);
                                return selectedRateType ? (
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-medium">{selectedRateType.name}</span>
                                    {selectedRateType.hasRate && selectedRateType.amount && (
                                      <span className="text-sm font-semibold text-green-600 ml-2">
                                        ₹{selectedRateType.amount}
                                      </span>
                                    )}
                                  </div>
                                ) : null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRateTypes?.map((rateType) => (
                            <SelectItem key={rateType.id} value={rateType.id.toString()}>
                              <div className="flex items-center justify-between w-full py-2">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{rateType.name}</span>
                                  {rateType.description && (
                                    <span className="text-xs text-muted-foreground mt-1">{rateType.description}</span>
                                  )}
                                </div>
                                {rateType.hasRate && rateType.amount && (
                                  <span className="text-sm font-semibold text-green-600 ml-4">
                                    ₹{rateType.amount}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {selectedClientId && selectedProductId && selectedVerificationTypeId && availableRateTypes.length === 0 && !loadingRateTypes && (
                        <p className="text-sm text-amber-600">
                          No rate types are configured for this client/product/verification type combination.
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                {/* Rate Calculation Display */}
                {selectedRateType && selectedRateType.hasRate && selectedRateType.amount && (
                  <div className="col-span-full">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-green-900">Rate Information</h4>
                          <p className="text-sm text-green-700">
                            Selected Rate Type: <span className="font-medium">{selectedRateType.name}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-700">
                            ₹{selectedRateType.amount}
                          </div>
                          <div className="text-sm text-green-600">
                            {selectedRateType.currency || 'INR'}
                          </div>
                        </div>
                      </div>
                      {selectedRateType.description && (
                        <p className="text-sm text-green-600 mt-2">
                          {selectedRateType.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* No Rate Warning */}
                {selectedRateType && !selectedRateType.hasRate && (
                  <div className="col-span-full">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="text-amber-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-amber-900">Rate Not Configured</h4>
                          <p className="text-sm text-amber-700">
                            The selected rate type "{selectedRateType.name}" does not have a rate amount configured. Please contact your administrator to set up the rate.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Assign to Field User */}
                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Field User *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select field user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loadingUsers ? (
                            <SelectItem value="loading" disabled>Loading users...</SelectItem>
                          ) : !fieldUsers || fieldUsers.length === 0 ? (
                            <SelectItem value="no-users" disabled>No field users available</SelectItem>
                          ) : (
                            fieldUsers.map((user) => (
                              <SelectItem key={user.id} value={String(user.id)}>
                                {user.name} ({user.email})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Priority */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attachments Section */}
          <CaseFormAttachmentsSection
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />

          {/* Form Actions */}
          <div className={`flex items-center ${onBack ? 'justify-between' : 'justify-end'} pt-6 border-t`}>
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Customer Info
              </Button>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editMode ? 'Updating Case...' : 'Creating Case...'}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {editMode ? 'Update Case' : 'Create & Assign Case'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
