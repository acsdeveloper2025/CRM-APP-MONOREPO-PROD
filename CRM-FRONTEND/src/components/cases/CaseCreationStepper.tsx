import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, User, FileText, Target } from 'lucide-react';
import { CustomerInfoStep, type CustomerInfoData } from './CustomerInfoStep';
import { FullCaseFormStep, type FullCaseFormData } from './FullCaseFormStep';
import { TaskCaseCreationForm, type CaseLevelFormData, type TaskFormData } from './TaskCaseCreationForm';

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

type Step = 'mode-selection' | 'customer-info' | 'case-details' | 'multi-task-details';
type CaseCreationMode = 'single-task' | 'multi-task';

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

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const staticIP = import.meta.env.VITE_STATIC_IP || 'PUBLIC_STATIC_IP';
  const isStaticIP = hostname === staticIP;
  const isDomain = hostname === 'example.com' || hostname === 'www.example.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return `http://${staticIP}:3000/api`;
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://example.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return `http://${staticIP}:3000/api`;
  }

  // 5. Fallback to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
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
  const [caseCreationMode, setCaseCreationMode] = useState<CaseCreationMode>('multi-task');
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
  const [deduplicationRationale, setDeduplicationRationale] = useState<string>('Case created through two-step workflow');

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

  const steps = editMode ? [
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
  ] : [
    {
      id: 'customer-info' as const,
      title: 'Customer Information',
      description: 'Enter customer details',
      icon: User,
      completed: currentStep === 'multi-task-details' || (currentStep === 'customer-info' && customerInfo !== null),
    },
    {
      id: 'multi-task-details' as const,
      title: 'Case & Task Details',
      description: 'Configure case and verification task',
      icon: Target,
      completed: false,
    },
  ];

  const performDeduplicationSearch = async (data: CustomerInfoData) => {
    setIsSearching(true);

    // Store customer info immediately when search is performed
    setCustomerInfo(data);

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
    setCurrentStep('multi-task-details');
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
    setDeduplicationRationale('Case created through two-step workflow');
  };

  const handleBackToCustomerInfo = () => {
    setCurrentStep('customer-info');
    setCaseFormData(null);
    // Reset deduplication when going back to customer info
    setDeduplicationCompleted(false);
    setDeduplicationResult(null);
    setDeduplicationRationale('Case created through two-step workflow');
  };



  const handleMultiTaskCaseCreation = async (caseLevelData: CaseLevelFormData, tasks: TaskFormData[]) => {
    if (!customerInfo) {
      toast.error('Customer information is missing');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get verification type names for task titles
      const getVerificationTypeName = (id: number) => {
        const vt = verificationTypes.find(v => v.id === id);
        return vt?.name || 'Verification';
      };

      // Get pincode code from pincode ID
      const getPincodeCode = (pincodeId: string) => {
        const pincode = pincodes.find(p => p.id.toString() === pincodeId);
        return pincode?.code || pincodeId;
      };

      // If only 1 task, use the regular single-task case creation endpoint
      if (tasks.length === 1) {
        const task = tasks[0];
        const selectedVerificationType = verificationTypes.find(vt => vt.id === task.verificationTypeId);
        const verificationTypeName = selectedVerificationType?.name || '';

        const caseData: CreateCaseData = {
          // Core case fields
          customerName: customerInfo.customerName,
          customerCallingCode: customerInfo.customerCallingCode,
          customerPhone: customerInfo.mobileNumber,
          createdByBackendUser: caseLevelData.createdByBackendUser,
          verificationType: mapVerificationType(verificationTypeName),
          address: task.address,
          pincode: getPincodeCode(task.pincodeId),
          assignedToId: task.assignedTo,
          clientId: caseLevelData.clientId,
          productId: caseLevelData.productId,
          verificationTypeId: task.verificationTypeId!.toString(),
          applicantType: task.applicantType,
          backendContactNumber: caseLevelData.backendContactNumber,
          priority: task.priority,
          trigger: task.trigger,
          rateTypeId: task.rateTypeId,

          // Deduplication fields
          panNumber: customerInfo.panNumber,
          deduplicationDecision: 'CREATE_NEW',
          deduplicationRationale: deduplicationRationale,
        };

        const response = await casesService.createCase(caseData);

        if (response.success) {
          // Upload attachments if any
          if (task.attachments && task.attachments.length > 0) {
            try {
              const files = task.attachments.map(att => att.file);
              // Extract caseId (integer) from response - must use integer for backend
              const caseId = response.data?.caseId ? String(response.data.caseId) : null;
              console.log('📎 Uploading attachments:', {
                caseId,
                caseIdType: typeof response.data?.caseId,
                fileCount: files.length,
                responseData: response.data
              });
              if (caseId) {
                await casesService.uploadCaseAttachments(caseId, files);
                toast.success(`Case created successfully with ${task.attachments.length} attachment(s)!`);
              } else {
                console.error('❌ No caseId found in response:', response.data);
                toast.error('Case created but caseId not found for attachment upload');
              }
            } catch (error: any) {
              console.error('❌ Error uploading attachments:', {
                error: error.message || error,
                stack: error.stack,
                caseId: response.data?.caseId
              });
              toast.error(`Case created but attachments failed: ${error.message || 'Unknown error'}`);
            }
          } else {
            toast.success('Case created successfully!');
          }

          if (onSuccess && response.data?.caseId) {
            onSuccess(response.data.caseId.toString());
          }
        } else {
          toast.error(response.message || 'Failed to create case');
        }
      } else {
        // Multiple tasks - use multi-task endpoint
        const payload = {
          case_details: {
            customerName: customerInfo.customerName,
            customerPhone: customerInfo.mobileNumber,
            customerCallingCode: customerInfo.customerCallingCode,
            clientId: parseInt(caseLevelData.clientId),
            productId: parseInt(caseLevelData.productId),
            backendContactNumber: caseLevelData.backendContactNumber,
            priority: 'MEDIUM',
            panNumber: customerInfo.panNumber,
            deduplicationDecision: 'CREATE_NEW',
            deduplicationRationale: deduplicationRationale,
          },
          verification_tasks: tasks.map((task, index) => ({
            verification_type_id: task.verificationTypeId!,
            task_title: `${getVerificationTypeName(task.verificationTypeId!)} - Task ${index + 1}`,
            task_description: task.trigger,
            priority: task.priority,
            assigned_to: task.assignedTo,
            rate_type_id: task.rateTypeId ? parseInt(task.rateTypeId) : undefined,
            address: task.address,
            pincode: getPincodeCode(task.pincodeId),
            applicantType: task.applicantType, // Use camelCase for consistency with single task endpoint
            trigger: task.trigger,
            document_type: task.documentType || undefined,
            document_number: task.documentNumber || undefined,
          }))
        };

        const response = await casesService.createCaseWithMultipleTasks(payload);

        if (response.success) {
          // Upload attachments for each task if any
          // Extract caseId (integer) from response - must use integer for backend
          const caseId = response.data?.case?.caseId ? String(response.data.case.caseId) : null;
          let totalAttachments = 0;

          console.log('📎 Multi-task case created, preparing to upload attachments:', {
            caseId,
            caseIdType: typeof response.data?.case?.caseId,
            tasksWithAttachments: tasks.filter(t => t.attachments && t.attachments.length > 0).length,
            responseData: response.data
          });

          if (caseId) {
            for (const task of tasks) {
              if (task.attachments && task.attachments.length > 0) {
                try {
                  const files = task.attachments.map(att => att.file);
                  console.log(`📎 Uploading ${files.length} files for task ${task.id}`);
                  await casesService.uploadCaseAttachments(caseId, files);
                  totalAttachments += files.length;
                } catch (error: any) {
                  console.error('❌ Error uploading task attachments:', {
                    taskId: task.id,
                    error: error.message || error,
                    stack: error.stack
                  });
                  toast.error(`Some attachments failed: ${error.message || 'Unknown error'}`);
                }
              }
            }
          } else {
            console.error('❌ No caseId found in multi-task response:', response.data);
            if (tasks.some(t => t.attachments && t.attachments.length > 0)) {
              toast.error('Case created but caseId not found for attachment upload');
            }
          }

          if (totalAttachments > 0) {
            toast.success(`Case created successfully with ${tasks.length} tasks and ${totalAttachments} attachment(s)!`);
          } else {
            toast.success(`Case created successfully with ${tasks.length} tasks!`);
          }

          if (onSuccess && response.data?.case?.caseId) {
            onSuccess(response.data.case.caseId.toString());
          }
        } else {
          toast.error(response.message || 'Failed to create case');
        }
      }
    } catch (error: any) {
      console.error('Error creating case:', error);
      toast.error(error.response?.data?.message || 'Failed to create case');
    } finally {
      setIsSubmitting(false);
    }
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
        deduplicationRationale: deduplicationRationale,
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

            const apiBaseUrl = getApiBaseUrl();
            const uploadResponse = await fetch(`${apiBaseUrl}/attachments/upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
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

  const handleCreateNewFromDialog = async (rationale: string) => {
    console.log('🚀 Create New Case Anyway button clicked with rationale:', rationale);

    if (!customerInfo) {
      console.error('❌ No customer info available');
      toast.error('Customer information is missing');
      return;
    }

    try {
      // Record the deduplication decision for creating new case (but don't block UI on this)
      if (deduplicationResult) {
        console.log('📝 Recording deduplication decision...');
        const decision = {
          caseId: 'NEW_CASE_PLACEHOLDER', // This will be updated by the backend
          decision: 'CREATE_NEW' as const,
          rationale,
          selectedExistingCaseId: undefined // No existing case selected
        };

        // Don't await this - let it happen in background
        deduplicationService.recordDeduplicationDecision(
          decision,
          deduplicationResult.duplicatesFound,
          deduplicationResult.searchCriteria
        ).catch(error => {
          console.error('Error recording deduplication decision (background):', error);
        });
      }

      // Immediately proceed to next step
      console.log('✅ Proceeding to case details step...');
      setDeduplicationRationale(rationale);
      setShowDeduplicationDialog(false);
      setDeduplicationResult(null);
      proceedToCaseDetails(customerInfo);
      toast.success('Proceeding to create new case despite duplicates');

    } catch (error) {
      console.error('Error in handleCreateNewFromDialog:', error);
      toast.error('An error occurred, but proceeding to create case anyway');

      // Still proceed even if there's an error
      setDeduplicationRationale(rationale);
      setShowDeduplicationDialog(false);
      setDeduplicationResult(null);
      proceedToCaseDetails(customerInfo);
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

        {currentStep === 'multi-task-details' && customerInfo && (
          <TaskCaseCreationForm
            customerInfo={customerInfo}
            onSubmit={handleMultiTaskCaseCreation}
            onBack={handleBackToCustomerInfo}
            isSubmitting={isSubmitting}
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
