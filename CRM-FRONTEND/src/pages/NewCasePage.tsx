import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CaseCreationStepper } from '@/components/cases/CaseCreationStepper';
import { useCase } from '@/hooks/useCases';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { CustomerInfoData } from '@/components/cases/CustomerInfoStep';
import type { FullCaseFormData } from '@/components/cases/FullCaseFormStep';
import { LoadingState } from '@/components/ui/loading';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editCaseId = searchParams.get('edit');
  const editTaskId = searchParams.get('taskId'); // Get the specific task ID to edit
  const isEditMode = !!editCaseId;


  const [initialData, setInitialData] = useState<{
    customerInfo?: CustomerInfoData;
    caseFormData?: FullCaseFormData; // Keeping for backward compatibility if needed, but mainly using new structure
    caseLevelData?: {
      clientId: string;
      productId: string;
      backendContactNumber: string;
      createdByBackendUser: string;
    };
    tasks?: Record<string, unknown>[];
  } | undefined>();

  // Only fetch case data if we're in edit mode
  const shouldFetchCase = isEditMode && editCaseId;
  const { data: caseData, isLoading: loadingCase } = useCase(shouldFetchCase ? editCaseId : '');

  // Fetch pincodes for mapping pincode code to ID in edit mode
  const { data: pincodesResponse } = usePincodes({ limit: 10000 });
  
  // Fetch verification tasks to get address (address is stored at task level, not case level)
  const { data: verificationTasksResponse } = useQuery({
    queryKey: ['verification-tasks', 'case', editCaseId],
    queryFn: async () => {
      const { VerificationTasksService } = await import('@/services/verificationTasks');
      return await VerificationTasksService.getTasksForCase(editCaseId || '');
    },
    enabled: isEditMode && !!editCaseId,
  });

  // Get pincode ID for fetching areas
  const [pincodeIdForAreas, setPincodeIdForAreas] = useState<number | undefined>();
  const { data: areasResponse } = useAreasByPincode(pincodeIdForAreas);

  // First useEffect: Set pincode ID for fetching areas (if pincode exists)
  useEffect(() => {
    if (isEditMode && caseData?.data && pincodesResponse?.data) {
      const caseItem = caseData.data;
      const pincodes = pincodesResponse.data;

      // Find pincode ID based on pincode code
      const foundPincode = pincodes.find(p => p.code === caseItem.pincode);
      if (foundPincode) {
        setPincodeIdForAreas(foundPincode.id);
      } else {
        // If pincode doesn't exist, still proceed with mapping (without areas)
        setPincodeIdForAreas(undefined);
      }
    }
  }, [isEditMode, caseData, pincodesResponse]);

  // Second useEffect: Map all case data when areas are loaded
  useEffect(() => {
    try {
      if (isEditMode && caseData?.data && pincodesResponse?.data) {
        const caseItem = caseData.data;
        const pincodes = pincodesResponse.data;
        const areas = areasResponse?.data || [];
        
        // Get address from verification task (address is stored at task level)
        const tasks = verificationTasksResponse?.data?.tasks || [];
        // If editTaskId is provided, find that specific task; otherwise use first task
        const firstTask = (editTaskId
          ? tasks.find((t: VerificationTask) => t.id === editTaskId)
          : tasks[0]) as unknown as Record<string, unknown>;
        
        if (!firstTask) {
          console.error('❌ Task not found', { editTaskId, availableTasks: tasks.map((t: VerificationTask) => t.id) });
          return;
        }
        
        const taskAddress = firstTask?.address || '';

        console.warn('🔍 NewCasePage - Mapping case data for edit mode', {
          caseId: editCaseId,
          taskId: editTaskId || firstTask?.id,
          firstTask,
          rate_type_id: firstTask?.rate_type_id,
          assigned_to: firstTask?.assigned_to,
        });

        // Find pincode ID based on pincode code
        const foundPincode = pincodes.find(p => p.code === caseItem.pincode);
        const pincodeId = foundPincode?.id?.toString() || '';

        // Find the correct area based on case data
        // Note: Case type doesn't have areaId property, use first available area
        const areaId = areas.length > 0 ? areas[0].id.toString() : '';

        // Map case data to CustomerInfoData format
        const customerInfo: CustomerInfoData = {
          customerName: String(caseItem.customerName || caseItem.applicantName || ''),
          mobileNumber: String(caseItem.customerPhone || caseItem.applicantPhone || ''),
          panNumber: String(caseItem.panNumber || ''),
          customerCallingCode: String(caseItem.customerCallingCode || '')
        };

        // Map case data to FullCaseFormData format
        const addressValue = taskAddress || caseItem.address || [caseItem.addressStreet, caseItem.addressCity, caseItem.addressState, caseItem.addressPincode].filter(Boolean).join(', ') || '';
        
        const caseFormData: FullCaseFormData = {
          clientId: String(caseItem.clientId || ''),
          productId: String(caseItem.productId || ''),
          verificationTypeId: String(caseItem.verificationTypeId || ''),
          applicantType: String(caseItem.applicantType || ''),
          createdByBackendUser: caseItem.createdByBackendUser?.name || String(caseItem.createdByBackendUser || ''), // Handle object or string
          backendContactNumber: String(caseItem.backendContactNumber || ''),
          assignedToId: '', // Case-level assignment is deprecated, leave empty
          priority: String(caseItem.priority || 'MEDIUM'), // Convert to string
          trigger: String(caseItem.trigger || caseItem.notes || ''), // Use trigger not notes
          address: addressValue,
          pincodeId, // Map pincode code to pincode ID
          areaId, // Use the found area ID
        };

        // Extract assignedTo from API response (snake_case)
        const assignedToId = firstTask?.assigned_to || '';

        const mappedData = {
          customerInfo,
          caseFormData, // Keeping for reference
          caseLevelData: {
            clientId: caseFormData.clientId,
            productId: caseFormData.productId,
            backendContactNumber: caseFormData.backendContactNumber,
            createdByBackendUser: caseFormData.createdByBackendUser,
          },
          tasks: [{
            id: editTaskId || firstTask?.id || '1', // Use the actual task ID
            applicantType: caseFormData.applicantType,
            verificationTypeId: caseFormData.verificationTypeId ? parseInt(caseFormData.verificationTypeId) : null,
            rateTypeId: firstTask?.rate_type_id?.toString() || '', // ✅ Use snake_case from API
            pincodeId: caseFormData.pincodeId,
            areaId: caseFormData.areaId,
            address: caseFormData.address,
            trigger: caseFormData.trigger,
            priority: (caseFormData.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM',
            assignedTo: assignedToId, // ✅ Use snake_case from API
            documentType: '',
            documentNumber: '',
            attachments: [],
          }]
        };

        console.warn('✅ NewCasePage - Mapped data ready', {
          rateTypeId: mappedData.tasks[0].rateTypeId,
          assignedTo: mappedData.tasks[0].assignedTo,
        });

                setInitialData(mappedData as unknown);
      }
    } catch (error) {
      // Only log errors in development mode
      if (import.meta.env.DEV) {
        console.error('Error in NewCasePage useEffect:', error);
      }
      // Don't redirect on error, just log it
    }

  }, [isEditMode, caseData, pincodesResponse, areasResponse, verificationTasksResponse, editCaseId, editTaskId]);

  const handleSuccess = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const handleCancel = () => {
    navigate('/cases');
  };



  if (isEditMode && loadingCase) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit Case</h1>
          <p className="text-gray-600">Loading case data... (ID: {editCaseId})</p>
        </div>
        <LoadingState message="Fetching case data..." size="lg" />
      </div>
    );
  }

  // Debug: Show if we're in edit mode but have no data
  if (isEditMode && !loadingCase && !caseData?.data) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-red-600">Edit Mode - No Data</h1>
          <div className="text-gray-600 space-y-2">
            <p>Edit Case ID: {editCaseId}</p>
            <p>Loading: {loadingCase ? 'Yes' : 'No'}</p>
            <p>Has Case Data: {caseData?.data ? 'Yes' : 'No'}</p>
            <div>
              <p>Case Data:</p>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40 text-left">
                {JSON.stringify(caseData, null, 2) || 'null'}
              </pre>
            </div>
          </div>
          <Button onClick={() => navigate('/cases')} className="mt-4">
            Back to Cases
          </Button>
        </div>
      </div>
    );
  }

  // Don't render the form in edit mode until we have initial data
  if (isEditMode && !initialData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit Case</h1>
          <p className="text-gray-600">Preparing form data... (ID: {editCaseId})</p>
        </div>
        <LoadingState message="Preparing form data..." size="lg" />
      </div>
    );
  }

  // Prevent editing completed cases ONLY if there are no pending/in-progress tasks
  // This handles cases where the status might be cached but revisit tasks exist
  const hasPendingTasks = (caseData?.data?.pendingTasks || 0) > 0 || (caseData?.data?.inProgressTasks || 0) > 0;
  const isCompleted = caseData?.data?.status === 'COMPLETED' && !hasPendingTasks;
  
  if (isEditMode && isCompleted) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <span className="inline-block bg-green-100 text-green-800 text-lg px-4 py-2 rounded-md font-medium">
                COMPLETED
              </span>
            </div>
            <h2 className="text-xl font-bold mb-2">Cannot Edit Completed Case</h2>
            <p className="text-gray-600 mb-6">
              This case has been marked as completed and can no longer be edited.
              If you need to make changes, please contact your administrator.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate(-1)} variant="outline">
                Go Back
              </Button>
              <Button onClick={() => navigate(`/cases/${editCaseId}`)}>
                View Case Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {isEditMode ? 'Edit Case' : 'Create New Case'}
        </h1>
        <p className="text-gray-600">
          {isEditMode
            ? 'Update the case details using the form below.'
            : 'Follow the steps below to create a new verification case with duplicate detection.'
          }
        </p>
      </div>

      <CaseCreationStepper
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        editMode={isEditMode}
        editCaseId={editCaseId || undefined}
        initialData={initialData}
      />
    </div>
  );
};
