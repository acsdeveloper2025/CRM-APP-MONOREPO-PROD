import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, User, Target } from 'lucide-react';
import { CustomerInfoStep, type CustomerInfoData } from './CustomerInfoStep';
import { FullCaseFormStep, type FullCaseFormData } from './FullCaseFormStep';
import { TaskCaseCreationForm, type CaseLevelFormData, type TaskFormData } from './TaskCaseCreationForm';

import { DeduplicationDialog } from './DeduplicationDialog';
import { deduplicationService, type DeduplicationResult } from '@/services/deduplication';
import { casesService, type CreateCaseData } from '@/services/cases';
import { attachmentsService } from '@/services/attachments';
import { usePincodes } from '@/hooks/useLocations';
import { useVerificationTypes } from '@/hooks/useClients';
import { toast } from 'sonner';
import type { CaseFormAttachment } from '@/components/attachments/CaseFormAttachmentsSection';

// Extended type for case updates that might include task ID
interface UpdateCasePayload extends CreateCaseData {
  taskId?: string;
}

interface CaseCreationStepperProps {
  onSuccess?: (caseId: string) => void;
  onCancel?: () => void;
  editMode?: boolean;
  editCaseId?: string;
  initialData?: {
    customerInfo?: CustomerInfoData;
    caseFormData?: FullCaseFormData;
    caseLevelData?: {
      clientId: string;
      productId: string;
      backendContactNumber: string;
      createdByBackendUser: string;
    };
    tasks?: TaskFormData[];
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

export const CaseCreationStepper: React.FC<CaseCreationStepperProps> = ({
  onSuccess,
  // onCancel - unused, keeping for interface compatibility
  editMode = false,
  editCaseId,
  initialData
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(
    editMode ? 'multi-task-details' : 'customer-info'
  );
  // Always using multi-task mode - keeping state for future use
  const [_caseCreationMode, _setCaseCreationMode] = useState<CaseCreationMode>('multi-task');
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
      description: 'Update customer details',
      icon: User,
      completed: currentStep === 'multi-task-details',
    },
    {
      id: 'multi-task-details' as const,
      title: 'Case & Task Details',
      description: 'Update case and verification tasks',
      icon: Target,
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
        setIsSearching(false);
        return;
      }

      console.warn('🔍 Performing deduplication search with criteria:', criteria);
      const result = await deduplicationService.searchDuplicates(criteria);
      console.warn('🔍 Deduplication search result:', result);

      if (result.success && result.data && result.data.duplicatesFound.length > 0) {
        // CRITICAL FIX: Show ALL duplicates, not just 100% matches
        // Let the user review and decide what to do
        console.warn(`⚠️ Found ${result.data.duplicatesFound.length} potential duplicate(s)`);

/*
        // Show detailed match information in console for debugging
        result.data.duplicatesFound.forEach((dup, index) => {
          console.warn(`  Duplicate ${index + 1}:`, {
            caseId: dup.caseId,
            customerName: dup.customerName,
            matchScore: dup.matchScore,
            matchType: dup.matchType,
          });
        });
*/

        // Always show the dialog when duplicates are found
        setDeduplicationResult(result.data);
        setShowDeduplicationDialog(true);
        setDeduplicationCompleted(true);

        // Use toast.error with orange/warning styling for duplicate alerts
        toast(`⚠️ Found ${result.data.duplicatesFound.length} potential duplicate case(s). Please review.`, {
          duration: 5000,
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FCD34D',
          },
        });
      } else {
        // No duplicates at all - auto-proceed as "No Duplicates Found"
        console.warn('✅ No duplicate cases found');
        toast.success('No duplicate cases found. Proceeding to create new case.');
        setDeduplicationRationale('No duplicate cases found during automated check');
        setDeduplicationCompleted(true);
        proceedToCaseDetails(data);
      }
    } catch (error) {
      console.error('❌ Deduplication search failed:', error);
      toast.error('Deduplication search failed. Please try again or contact support.');
      setDeduplicationCompleted(false);
      setIsSearching(false);
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

      const parsedClientId = parseInt(caseLevelData.clientId, 10);
      const parsedProductId = parseInt(caseLevelData.productId, 10);
      if (!Number.isFinite(parsedClientId) || !Number.isFinite(parsedProductId)) {
        toast.error('Client and Product are required');
        return;
      }

      // Handle Edit Mode - Update Case
      if (editMode && editCaseId) {
        // For edit mode, we currently only support updating the case details and the first task
        // This is a limitation of the current backend API for updates
        const task = tasks[0];
        const selectedVerificationType = verificationTypes.find(vt => vt.id === task.verificationTypeId);
        const verificationTypeName = selectedVerificationType?.name || '';

        const caseData: UpdateCasePayload = {
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
          verificationTypeId: (task.verificationTypeId || '').toString(),
          applicantType: task.applicantType,
          backendContactNumber: caseLevelData.backendContactNumber,
          priority: task.priority,
          trigger: task.trigger,
          rateTypeId: task.rateTypeId,
          taskId: task.id, // ✅ Pass the specific task ID to update

          // Deduplication fields
          panNumber: customerInfo.panNumber,
          deduplicationDecision: 'NO_DUPLICATES_FOUND', // Not relevant for update
          deduplicationRationale: 'Case update',
        };

        const response = await casesService.updateCaseDetails(editCaseId, caseData);

        if (response.success) {
          // Upload attachments if any
          const newAttachments = (task.attachments || []).filter(att => att.id.startsWith('temp-'));
          if (newAttachments.length > 0) {
            try {
              const files = newAttachments.map(att => att.file);
              // For updates, we upload to the case generally or need task ID if available
              // Current update response might not return task IDs easily, so we upload to case
              // Ideally we should get the task ID for the updated task
              
            const uploadResponse = await attachmentsService.uploadAttachments({
                caseId: editCaseId,
                files,
                category: 'DOCUMENT'
            });

              if (uploadResponse.success) {
                toast.success(`${files.length} attachment(s) uploaded successfully`);
              } else {
                console.error('Attachment upload failed');
                toast.error('Case updated but attachments failed to upload');
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error('Error uploading attachments:', error);
              toast.error(`Case updated but attachments failed: ${errorMessage}`);
            }
          } else {
            toast.success('Case updated successfully!');
          }

          if (onSuccess) {
            onSuccess(editCaseId);
          }
        } else {
          toast.error(response.message || 'Failed to update case');
        }
        return;
      }

      const applicantsByType = new Map<string, TaskFormData[]>();
      for (const task of tasks) {
        const applicantType = task.applicantType || 'APPLICANT';
        const existingTasks = applicantsByType.get(applicantType) || [];
        existingTasks.push(task);
        applicantsByType.set(applicantType, existingTasks);
      }

      const applicants = Array.from(applicantsByType.entries()).map(([role, applicantTasks]) => ({
        name: customerInfo.customerName,
        mobile: customerInfo.mobileNumber || '',
        role,
        pan_number: customerInfo.panNumber || undefined,
        verifications: applicantTasks.map(applicantTask => ({
          verification_type_id: applicantTask.verificationTypeId ?? null,
          address: applicantTask.address,
          pincode_id: Number.isNaN(parseInt(applicantTask.pincodeId, 10))
            ? undefined
            : parseInt(applicantTask.pincodeId, 10),
          area_id: Number.isNaN(parseInt(applicantTask.areaId, 10))
            ? undefined
            : parseInt(applicantTask.areaId, 10),
          assigned_to: applicantTask.assignedTo || undefined,
        })),
      }));

      const firstTask = tasks[0];
      const payload = {
        case_details: {
          customerName: customerInfo.customerName,
          customerPhone: customerInfo.mobileNumber,
          customerCallingCode: customerInfo.customerCallingCode,
          clientId: parsedClientId,
          productId: parsedProductId,
          verificationTypeId: firstTask?.verificationTypeId ?? undefined,
          applicantType: firstTask?.applicantType,
          trigger: firstTask?.trigger,
          backendContactNumber: caseLevelData.backendContactNumber,
          priority: firstTask?.priority || 'MEDIUM',
          pincode: firstTask ? getPincodeCode(firstTask.pincodeId) : '',
          panNumber: customerInfo.panNumber,
          deduplicationDecision: deduplicationRationale.includes('No duplicate cases found') ? 'NO_DUPLICATES_FOUND' : 'CREATE_NEW',
          deduplicationRationale,
        },
        applicants,
        verification_tasks: tasks.map((task, index) => {
          if (!task.verificationTypeId) {
            throw new Error(`Verification type missing for task ${index + 1}`);
          }
          return {
            verification_type_id: task.verificationTypeId as number,
            task_title: `${getVerificationTypeName(task.verificationTypeId as number)} - Task ${index + 1}`,
            task_description: task.trigger,
            priority: task.priority,
            assigned_to: task.assignedTo || undefined,
            rate_type_id: task.rateTypeId ? parseInt(task.rateTypeId, 10) : undefined,
            address: task.address,
            pincode: getPincodeCode(task.pincodeId),
            area_id: Number.isNaN(parseInt(task.areaId, 10))
              ? undefined
              : parseInt(task.areaId, 10),
            applicant_type: task.applicantType,
            trigger: task.trigger,
            document_type: task.documentType || undefined,
            document_number: task.documentNumber || undefined,
          };
        })
      };


      const response = await casesService.createCaseWithMultipleTasks(payload);

      if (response.success && response.data) {
        const caseId = response.data.case?.caseId ? String(response.data.case.caseId) : null;
        const createdTasks = response.data.tasks || [];
        let totalAttachments = 0;

        if (caseId && createdTasks.length > 0) {
          for (let i = 0; i < tasks.length; i++) {
            const frontendTask = tasks[i];
            const backendTask = createdTasks[i];

            const newAttachments = (frontendTask.attachments || []).filter(att => att.id.startsWith('temp-'));
            if (newAttachments.length > 0 && backendTask) {
              try {
                const files = newAttachments.map(att => att.file);
                await casesService.uploadCaseAttachments(caseId, files, backendTask.id);
                totalAttachments += files.length;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('❌ Error uploading task attachments:', {
                  taskIndex: i,
                  taskId: backendTask?.id,
                  error: errorMessage,
                });
                toast.error(`Some attachments failed: ${errorMessage}`);
              }
            }
          }
        } else if (tasks.some(t => t.attachments && t.attachments.length > 0)) {
          toast.error('Case created but caseId/tasks not found for attachment upload');
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
    } catch (error) {
      console.error('Error creating case:', error);
      toast.error('Failed to create case. Please check your input.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCaseFormSubmit = async (data: FullCaseFormData, attachments: CaseFormAttachment[] = []) => {
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
        verificationTypeId, // Keep as string - backend will convert
        applicantType: data.applicantType,
        backendContactNumber: data.backendContactNumber,
        priority: data.priority,
        trigger: data.trigger,
        rateTypeId: data.rateTypeId, // Keep as string - backend will convert

        // Deduplication fields
        panNumber: customerInfo.panNumber,
        deduplicationDecision: deduplicationRationale.includes('No duplicate cases found') ? 'NO_DUPLICATES_FOUND' : 'CREATE_NEW',
        deduplicationRationale,
      };

      const parsedClientId = parseInt(caseData.clientId, 10);
      const parsedProductId = caseData.productId ? parseInt(caseData.productId, 10) : undefined;
      if (!Number.isFinite(parsedClientId) || (caseData.productId && !Number.isFinite(parsedProductId))) {
        toast.error('Client and Product are required');
        return;
      }

      let result;
      if (editMode && editCaseId) {
        result = await casesService.updateCaseDetails(editCaseId, caseData);

        // Handle attachments separately for edit mode (if needed)
        if (attachments.length > 0) {
          try {
            const files = attachments.map(att => att.file);
            const uploadResponse = await attachmentsService.uploadAttachments({
                caseId: editCaseId,
                files,
                category: 'DOCUMENT'
            });

            if (uploadResponse.success) {
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
        const payload = {
          case_details: {
            customerName: caseData.customerName,
            customerPhone: caseData.customerPhone,
            customerCallingCode: caseData.customerCallingCode,
            clientId: parsedClientId,
            productId: parsedProductId,
            verificationTypeId: caseData.verificationTypeId ? parseInt(caseData.verificationTypeId, 10) : undefined,
            applicantType: caseData.applicantType,
            trigger: caseData.trigger,
            backendContactNumber: caseData.backendContactNumber,
            priority: caseData.priority || 'MEDIUM',
            pincode: caseData.pincode,
            deduplicationDecision: caseData.deduplicationDecision,
            deduplicationRationale: caseData.deduplicationRationale,
            panNumber: caseData.panNumber,
          },
          applicants: [{
            name: caseData.customerName,
            mobile: caseData.customerPhone || '',
            role: caseData.applicantType || 'APPLICANT',
            pan_number: caseData.panNumber || undefined,
            verifications: [{
              verification_type_id: caseData.verificationTypeId ? parseInt(caseData.verificationTypeId, 10) : null,
              address: caseData.address,
              pincode_id: Number.isNaN(parseInt(data.pincodeId, 10))
                ? undefined
                : parseInt(data.pincodeId, 10),
              area_id: Number.isNaN(parseInt(data.areaId, 10))
                ? undefined
                : parseInt(data.areaId, 10),
              assigned_to: caseData.assignedToId || undefined,
            }],
          }],
          verification_tasks: [{
            verification_type_id: caseData.verificationTypeId ? parseInt(caseData.verificationTypeId, 10) : 0,
            task_title: `${caseData.verificationType || 'Verification'} Task`,
            task_description: caseData.trigger,
            priority: caseData.priority || 'MEDIUM',
            assigned_to: caseData.assignedToId || undefined,
            rate_type_id: caseData.rateTypeId ? parseInt(caseData.rateTypeId, 10) : undefined,
            address: caseData.address,
            pincode: caseData.pincode,
            area_id: Number.isNaN(parseInt(data.areaId, 10))
              ? undefined
              : parseInt(data.areaId, 10),
            applicant_type: caseData.applicantType,
            trigger: caseData.trigger,
          }]
        };


        result = await casesService.createCaseWithMultipleTasks(payload);

        if (result.success && attachments.length > 0) {
          const attachmentFiles = attachments.map(att => att.file);
          const createdCaseId = result.data?.case?.caseId ? String(result.data.case.caseId) : null;
          const createdTaskId = result.data?.tasks?.[0]?.id || null;
          if (createdCaseId && createdTaskId) {
            await casesService.uploadCaseAttachments(createdCaseId, attachmentFiles, createdTaskId);
            toast.success(`Case created successfully with ${attachments.length} attachment(s)!`);
          } else {
            toast.error('Case created but attachment upload skipped because case/task id missing');
          }
        }
      }

      if (result.success && result.data) {
        // Handle different response structures: Case (from update) vs CreateCaseWithMultipleTasksResponse (from create)
        const caseId = 'case' in result.data ? result.data.case.caseId : (result.data.caseId || result.data.id);

        const action = editMode ? 'updated' : 'created';
        toast.success(`Case ${action} successfully! Case ID: ${caseId}`);
        onSuccess?.(String(caseId));
      } else {
        const action = editMode ? 'update' : 'create';
        toast.error(`Failed to ${action} case`);
      }
    } catch (error) {
      console.error('Error in handleCaseFormSubmit:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewFromDialog = async (rationale: string) => {


    if (!customerInfo) {
      console.error('❌ No customer info available');
      toast.error('Customer information is missing');
      return;
    }

    try {
      // Record the deduplication decision for creating new case (but don't block UI on this)
      if (deduplicationResult) {

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ).catch((error: any) => {
          console.error('Error recording deduplication decision (background):', error);
        });
      }

      // Immediately proceed to next step

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
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800/60 border-border text-gray-600'
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
                          isActive ? 'text-green-600' : isCompleted ? 'text-green-600' : 'text-gray-600'
                        }`}
                      >
                        {step.title}
                      </span>
                      <span className="text-xs text-gray-600">{step.description}</span>
                    </div>
                  </div>
                  
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-slate-100 dark:bg-slate-800/60'
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

        {/* FullCaseFormStep removed for edit mode as we now use TaskCaseCreationForm */}
        {/* Keeping logic for reference if needed, but it won't be rendered based on steps config */}
        {currentStep === 'case-details' && !editMode && (editMode || customerInfo) && (
          <FullCaseFormStep
            customerInfo={(customerInfo || initialData?.customerInfo || {}) as CustomerInfoData}
            onSubmit={handleCaseFormSubmit}
            onBack={editMode ? undefined : handleBackToCustomerInfo}
            isSubmitting={isSubmitting}
            initialData={caseFormData || initialData?.caseFormData || {}}
            editMode={editMode}
          />
        )}

        {currentStep === 'multi-task-details' && (editMode || customerInfo) && (
          <TaskCaseCreationForm
            customerInfo={(customerInfo || initialData?.customerInfo || {}) as CustomerInfoData}
            onSubmit={handleMultiTaskCaseCreation}
            onBack={editMode ? undefined : handleBackToCustomerInfo}
            isSubmitting={isSubmitting}
            initialData={editMode && initialData ? {
              caseLevelData: initialData.caseLevelData || initialData.caseFormData,
              tasks: initialData.tasks // ✅ Use tasks directly from NewCasePage
            } : undefined}
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
