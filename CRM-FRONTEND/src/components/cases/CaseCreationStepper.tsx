import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, User, FileText } from 'lucide-react';
import { CustomerInfoStep, type CustomerInfoData } from './CustomerInfoStep';
import { FullCaseFormStep, type FullCaseFormData } from './FullCaseFormStep';
import { DeduplicationDialog } from './DeduplicationDialog';
import { deduplicationService, type DeduplicationResult } from '@/services/deduplication';
import { casesService, type CreateCaseData } from '@/services/cases';
import { usePincodes } from '@/hooks/useLocations';
import { useVerificationTypes } from '@/hooks/useClients';
import toast from 'react-hot-toast';

interface CaseCreationStepperProps {
  onSuccess?: (caseId: string) => void;
  onCancel?: () => void;
  editMode?: boolean;
  editCaseId?: string;
  initialData?: {
    customerInfo?: CustomerInfoData;
    caseFormData?: FullCaseFormData;
  };
}

type Step = 'customer-info' | 'case-details';

// Helper function to map verification type names to backend expected values
const mapVerificationType = (verificationType: string): string => {
  const typeMap: Record<string, string> = {
    'Residence Verification': 'RESIDENCE',
    'Office Verification': 'OFFICE',
    'Business Verification': 'BUSINESS',
    'Other Verification': 'OTHER',
    'RESIDENCE': 'RESIDENCE',
    'OFFICE': 'OFFICE',
    'BUSINESS': 'BUSINESS',
    'OTHER': 'OTHER'
  };
  return typeMap[verificationType] || 'OTHER';
};

export const CaseCreationStepper: React.FC<CaseCreationStepperProps> = ({
  onSuccess,
  onCancel,
  editMode = false,
  editCaseId,
  initialData
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(
    editMode ? 'case-details' : 'customer-info'
  );
  const [customerInfo, setCustomerInfo] = useState<CustomerInfoData | null>(
    initialData?.customerInfo || null
  );
  const [caseFormData, setCaseFormData] = useState<FullCaseFormData | null>(
    initialData?.caseFormData || null
  );

  // Deduplication state
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deduplicationResult, setDeduplicationResult] = useState<DeduplicationResult | null>(null);
  const [showDeduplicationDialog, setShowDeduplicationDialog] = useState(false);
  const [deduplicationCompleted, setDeduplicationCompleted] = useState(false);

  // Fetch pincodes for code lookup
  const { data: pincodesResponse } = usePincodes();
  const pincodes = pincodesResponse?.data || [];

  // Fetch verification types for ID lookup
  const { data: verificationTypesResponse } = useVerificationTypes();
  const verificationTypes = verificationTypesResponse?.data || [];

  // Update state when initialData changes (for edit mode)
  useEffect(() => {
    if (editMode && initialData) {
      if (initialData.customerInfo) {
        setCustomerInfo(initialData.customerInfo);
      }
      if (initialData.caseFormData) {
        setCaseFormData(initialData.caseFormData);
      }
    }
  }, [editMode, initialData]);

  const steps = [
    {
      id: 'customer-info' as const,
      title: 'Customer Information',
      description: 'Enter customer details',
      icon: User,
      completed: editMode || currentStep === 'case-details' || (currentStep === 'customer-info' && customerInfo !== null),
    },
    {
      id: 'case-details' as const,
      title: 'Case Details',
      description: 'Complete case information',
      icon: FileText,
      completed: false,
    },
  ];

  const performDeduplicationSearch = async (data: CustomerInfoData) => {
    setIsSearching(true);
    
    try {
      const criteria = deduplicationService.cleanCriteria({
        customerName: data.customerName,
        panNumber: data.panNumber,
        customerPhone: data.mobileNumber,
      });

      const validation = deduplicationService.validateCriteria(criteria);
      if (!validation.isValid) {
        toast.error(`Validation errors: ${validation.errors.join(', ')}`);
        return;
      }

      const result = await deduplicationService.searchDuplicates(criteria);
      
      if (result.success && result.data.duplicatesFound.length > 0) {
        setDeduplicationResult(result.data);
        setShowDeduplicationDialog(true);
        setDeduplicationCompleted(true);
      } else {
        toast.success('No duplicate cases found. You can now create a new case.');
        setDeduplicationCompleted(true);
      }
    } catch (error) {
      console.error('Deduplication search failed:', error);
      toast.error('Deduplication search failed. You can still create a new case.');
      setDeduplicationCompleted(true);
    } finally {
      setIsSearching(false);
    }
  };

  const proceedToCaseDetails = (data: CustomerInfoData) => {
    setCustomerInfo(data);
    setCurrentStep('case-details');
  };

  const handleSearchExisting = (data: CustomerInfoData) => {
    performDeduplicationSearch(data);
  };

  const handleCreateNew = (data: CustomerInfoData) => {
    proceedToCaseDetails(data);
  };

  const handleCustomerDataChange = () => {
    // Reset deduplication when customer data changes
    setDeduplicationCompleted(false);
    setDeduplicationResult(null);
  };

  const handleBackToCustomerInfo = () => {
    setCurrentStep('customer-info');
    setCaseFormData(null);
    // Reset deduplication when going back to customer info
    setDeduplicationCompleted(false);
    setDeduplicationResult(null);
  };

  const handleCaseFormSubmit = async (data: FullCaseFormData, attachments: any[] = []) => {
    if (!customerInfo) {
      toast.error('Customer information is missing');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get pincode code from pincode ID for backend compatibility
      const selectedPincode = pincodes.find(p => p.id.toString() === data.pincodeId);
      const pincodeCode = selectedPincode?.code || data.pincodeId;

      // Use verification type ID directly from form data
      const verificationTypeId = data.verificationTypeId;

      // Get verification type name for legacy verificationType field
      const selectedVerificationType = verificationTypes.find(vt => vt.id.toString() === data.verificationTypeId);
      const verificationTypeName = selectedVerificationType?.name || '';

      const caseData: CreateCaseData = {
        // Core case fields
        customerName: customerInfo.customerName,
        customerCallingCode: customerInfo.customerCallingCode,
        customerPhone: customerInfo.mobileNumber,
        createdByBackendUser: data.createdByBackendUser,
        verificationType: mapVerificationType(verificationTypeName),
        address: data.address,
        pincode: pincodeCode, // Use actual pincode code, not ID
        assignedToId: data.assignedToId,
        clientId: data.clientId, // Keep as string - backend will convert
        productId: data.productId, // Keep as string - backend will convert
        verificationTypeId: verificationTypeId, // Keep as string - backend will convert
        applicantType: data.applicantType,
        backendContactNumber: data.backendContactNumber,
        priority: data.priority,
        trigger: data.trigger,
        rateTypeId: data.rateTypeId, // Keep as string - backend will convert

        // Deduplication fields
        panNumber: customerInfo.panNumber,
        deduplicationDecision: 'CREATE_NEW',
        deduplicationRationale: 'Case created through two-step workflow',
      };

      let result;
      if (editMode && editCaseId) {
        result = await casesService.updateCaseDetails(editCaseId, caseData);

        // Handle attachments separately for edit mode (if needed)
        if (attachments.length > 0) {
          try {
            const formData = new FormData();
            attachments.forEach(attachment => {
              formData.append('files', attachment.file);
            });
            formData.append('caseId', String(editCaseId));
            formData.append('category', 'DOCUMENT');

            const uploadResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/attachments/upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
              },
              body: formData,
            });

            if (uploadResponse.ok) {
              toast.success(`${attachments.length} file(s) uploaded successfully`);
            } else {
              toast.error('Case updated but some attachments failed to upload');
            }
          } catch (uploadError) {
            console.error('Attachment upload failed:', uploadError);
            toast.error('Case updated but attachments failed to upload');
          }
        }
      } else {
        // Create new case with attachments in single request
        if (attachments.length > 0) {
          const attachmentFiles = attachments.map(att => att.file);
          result = await casesService.createCaseWithAttachments(caseData, attachmentFiles);

          if (result.success) {
            toast.success(`Case created successfully with ${result.data.attachmentCount || attachments.length} attachment(s)`);
          }
        } else {
          // No attachments, use regular create endpoint
          result = await casesService.createCase(caseData);
        }
      }

      if (result.success) {
        const caseId = result.data.caseId || result.data.id;

        const action = editMode ? 'updated' : 'created';
        toast.success(`Case ${action} successfully! Case ID: ${caseId}`);
        onSuccess?.(String(caseId));
      } else {
        const action = editMode ? 'update' : 'create';
        toast.error(`Failed to ${action} case`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Failed to create case';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewFromDialog = (rationale: string) => {
    if (customerInfo) {
      proceedToCaseDetails(customerInfo);
      setShowDeduplicationDialog(false);
      setDeduplicationResult(null);
    }
  };

  const handleUseExistingFromDialog = async (caseId: string, rationale: string) => {
    try {
      // Record the deduplication decision
      if (deduplicationResult && customerInfo) {
        const decision = {
          caseId: 'NEW_CASE_PLACEHOLDER', // This will be updated by the backend
          decision: 'USE_EXISTING' as const,
          rationale,
          selectedExistingCaseId: caseId
        };

        await deduplicationService.recordDeduplicationDecision(
          decision,
          deduplicationResult.duplicatesFound,
          deduplicationResult.searchCriteria
        );
      }

      toast.success(`Redirecting to existing case: ${caseId}`);
      setShowDeduplicationDialog(false);
      setDeduplicationResult(null);

      // Navigate to the existing case instead of canceling
      onSuccess?.(caseId);
    } catch (error) {
      console.error('Error recording deduplication decision:', error);
      toast.error('Failed to record decision, but redirecting to case anyway');

      // Still navigate even if recording fails
      setShowDeduplicationDialog(false);
      setDeduplicationResult(null);
      onSuccess?.(caseId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Progress Stepper */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = step.completed;
              const Icon = step.icon;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center space-x-3">
                    <div
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                        ${isCompleted 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : isActive 
                            ? 'bg-blue-500 border-blue-500 text-white' 
                            : 'bg-muted border-border text-muted-foreground'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-medium ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                        }`}
                      >
                        {step.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{step.description}</span>
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-muted'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[600px]">
        {currentStep === 'customer-info' && (
          <CustomerInfoStep
            onSearchExisting={handleSearchExisting}
            onCreateNew={handleCreateNew}
            isSearching={isSearching}
            initialData={customerInfo || {}}
            deduplicationCompleted={deduplicationCompleted}
            onDataChange={handleCustomerDataChange}
          />
        )}

        {currentStep === 'case-details' && (editMode || customerInfo) && (
          <FullCaseFormStep
            customerInfo={customerInfo || initialData?.customerInfo || {}}
            onSubmit={handleCaseFormSubmit}
            onBack={editMode ? undefined : handleBackToCustomerInfo}
            isSubmitting={isSubmitting}
            initialData={caseFormData || initialData?.caseFormData || {}}
            editMode={editMode}
          />
        )}
      </div>

      {/* Deduplication Dialog */}
      <DeduplicationDialog
        isOpen={showDeduplicationDialog}
        onClose={() => {
          setShowDeduplicationDialog(false);
          setDeduplicationResult(null);
        }}
        deduplicationResult={deduplicationResult}
        onCreateNew={handleCreateNewFromDialog}
        onUseExisting={handleUseExistingFromDialog}
        isProcessing={isSubmitting}
      />
    </div>
  );
};
