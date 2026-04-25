import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CaseCreationStepper } from '@/components/cases/CaseCreationStepper';
import { useCase } from '@/hooks/useCases';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { attachmentsService, type Attachment } from '@/services/attachments';
import type { CustomerInfoData } from '@/components/cases/CustomerInfoStep';
import type { FullCaseFormData } from '@/components/cases/FullCaseFormStep';
import { LoadingState } from '@/components/ui/loading';
import type { VerificationTask } from '@/types/verificationTask';
import type { TaskFormData, CaseLevelFormData } from '@/components/cases/TaskCaseCreationForm';
import type { CaseFormAttachment } from '@/components/attachments/CaseFormAttachmentsSection';
import { logger } from '@/utils/logger';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editCaseId = searchParams.get('edit');
  const editTaskId = searchParams.get('taskId'); // Get the specific task ID to edit
  const isEditMode = !!editCaseId;

  const [initialData, setInitialData] = useState<
    | {
        customerInfo?: CustomerInfoData;
        caseFormData?: FullCaseFormData; // Keeping for backward compatibility if needed, but mainly using new structure
        caseLevelData?: CaseLevelFormData;
        tasks?: TaskFormData[];
      }
    | undefined
  >();

  // Only fetch case data if we're in edit mode
  const shouldFetchCase = isEditMode && editCaseId;
  const { data: caseData, isLoading: loadingCase } = useCase(shouldFetchCase ? editCaseId : '');

  // In edit mode, fetch only the specific pincode(s) needed for mapping (replaces bulk 10K load)
  const [editPincodeCode, setEditPincodeCode] = useState<string>('');
  const { data: pincodesResponse } = usePincodes({
    search: editPincodeCode,
    limit: 30,
  });

  // Fetch verification tasks to get address (address is stored at task level, not case level)
  const { data: verificationTasksResponse } = useQuery({
    queryKey: ['verification-tasks', 'case', editCaseId],
    queryFn: async () => {
      const { VerificationTasksService } = await import('@/services/verificationTasks');
      return await VerificationTasksService.getTasksForCase(editCaseId || '');
    },
    enabled: isEditMode && !!editCaseId,
  });

  const { data: caseAttachmentsResponse } = useQuery({
    queryKey: ['case-attachments', editCaseId],
    queryFn: async () => attachmentsService.getAttachmentsByCase(editCaseId || ''),
    enabled: isEditMode && !!editCaseId,
  });

  // Get pincode ID for fetching areas
  const [pincodeIdForAreas, setPincodeIdForAreas] = useState<number | undefined>();
  const { data: areasResponse } = useAreasByPincode(pincodeIdForAreas);

  // Extract pincode code from case/task data to trigger targeted search
  useEffect(() => {
    if (isEditMode && caseData?.data) {
      const tasks = verificationTasksResponse?.data?.tasks || [];
      const selectedTask = editTaskId
        ? tasks.find((t: VerificationTask) => t.id === editTaskId)
        : tasks[0];
      const taskPincodeCode = (selectedTask as unknown as Record<string, unknown>)?.pincode as
        | string
        | undefined;
      const code = taskPincodeCode || caseData.data.pincode;
      if (code && code !== editPincodeCode) {
        setEditPincodeCode(code);
      }
    }
  }, [isEditMode, caseData, verificationTasksResponse, editTaskId, editPincodeCode]);

  // First useEffect: Set pincode ID for fetching areas (if pincode exists)
  useEffect(() => {
    if (isEditMode && caseData?.data && pincodesResponse?.data) {
      const caseItem = caseData.data;
      const pincodes = pincodesResponse.data;
      const tasks = verificationTasksResponse?.data?.tasks || [];
      const selectedTask = editTaskId
        ? tasks.find((t: VerificationTask) => t.id === editTaskId)
        : tasks[0];
      const taskPincodeCode = (selectedTask as unknown as Record<string, unknown>)?.pincode as
        | string
        | undefined;
      const effectivePincodeCode = taskPincodeCode || caseItem.pincode;

      // Find pincode ID based on task-level pincode code first
      const foundPincode = pincodes.find((p) => p.code === effectivePincodeCode);
      if (foundPincode) {
        setPincodeIdForAreas(parseInt(foundPincode.id));
      } else {
        // If pincode doesn't exist, still proceed with mapping (without areas)
        setPincodeIdForAreas(undefined);
      }
    }
  }, [isEditMode, caseData, pincodesResponse, verificationTasksResponse, editTaskId]);

  // Second useEffect: Map all case data when areas are loaded
  useEffect(() => {
    try {
      if (isEditMode && caseData?.data && pincodesResponse?.data) {
        const caseItem = caseData.data;
        const pincodes = pincodesResponse.data;

        const tasks = verificationTasksResponse?.data?.tasks || [];
        if (!tasks.length) {
          logger.error('❌ No tasks found for case in edit mode', {
            editTaskId,
            caseId: editCaseId,
          });
          return;
        }

        // If taskId is provided, edit that single task; otherwise map all tasks for case edit
        const selectedTasks = editTaskId
          ? tasks.filter((t: VerificationTask) => t.id === editTaskId)
          : tasks;

        if (!selectedTasks.length) {
          logger.error('❌ Task not found', {
            editTaskId,
            availableTasks: tasks.map((t: VerificationTask) => t.id),
          });
          return;
        }

        const firstTask = selectedTasks[0] as unknown as Record<string, unknown>;
        const taskAddress = firstTask?.address || '';

        logger.warn('🔍 NewCasePage - Mapping case data for edit mode', {
          caseId: editCaseId,
          taskId: editTaskId || firstTask?.id,
          firstTask,
          rateTypeId: firstTask?.rateTypeId,
          assignedTo: firstTask?.assignedTo,
        });

        const taskPincodeCode = firstTask?.pincode as string | undefined;
        const effectivePincodeCode = taskPincodeCode || String(caseItem.pincode || '');

        // Find pincode ID based on task-level pincode code first
        const foundPincode = pincodes.find((p) => p.code === effectivePincodeCode);
        const pincodeId = foundPincode?.id?.toString() || '';

        // Use task-level areaId directly when available
        const taskAreaId = firstTask?.areaId || firstTask?.areaId;
        const areaId = taskAreaId ? String(taskAreaId) : '';

        // Map case data to CustomerInfoData format
        const customerInfo: CustomerInfoData = {
          customerName: String(caseItem.customerName || caseItem.applicantName || ''),
          mobileNumber: String(caseItem.customerPhone || caseItem.applicantPhone || ''),
          panNumber: String(caseItem.panNumber || ''),
          customerCallingCode: String(caseItem.customerCallingCode || ''),
        };

        // Map case data to FullCaseFormData format
        const addressValue =
          taskAddress ||
          caseItem.address ||
          [
            caseItem.addressStreet,
            caseItem.addressCity,
            caseItem.addressState,
            caseItem.addressPincode,
          ]
            .filter(Boolean)
            .join(', ') ||
          '';

        const caseFormData: FullCaseFormData = {
          clientId: String(caseItem.clientId || ''),
          productId: String(caseItem.productId || ''),
          verificationTypeId: String(caseItem.verificationTypeId || ''),
          applicantType: String(caseItem.applicantType || ''),
          createdByBackendUser:
            caseItem.createdByBackendUser?.name || String(caseItem.createdByBackendUser || ''), // Handle object or string
          backendContactNumber: String(caseItem.backendContactNumber || ''),
          assignedToId: '', // Case-level assignment is deprecated, leave empty
          priority: String(caseItem.priority || 'MEDIUM'), // Convert to string
          trigger: String(caseItem.trigger || caseItem.notes || ''), // Use trigger not notes
          address: String(addressValue),
          pincodeId, // Map pincode code to pincode ID
          areaId, // Use the found area ID
        };

        const allAttachments = (caseAttachmentsResponse?.data || []) as Attachment[];
        const mapAttachment = (att: Attachment): CaseFormAttachment => {
          const fileName = String(att.originalName || att.filename || 'attachment');
          const mimeType = String(att.mimeType || 'application/octet-stream');
          const size = Number(att.size || att.fileSize || 0);
          const placeholderFile = new File([], fileName, { type: mimeType });
          return {
            id: String(att.id),
            file: placeholderFile,
            name: fileName,
            size,
            type: mimeType.startsWith('image/') ? 'image' : 'pdf',
            mimeType,
          };
        };

        const mappedTasks: TaskFormData[] = selectedTasks.map((task: VerificationTask) => {
          const taskRecord = task as unknown as Record<string, unknown>;
          const rawAssignedTo = taskRecord.assignedTo || taskRecord.assignedTo;
          const assignedToId =
            typeof rawAssignedTo === 'object' && rawAssignedTo
              ? String((rawAssignedTo as { id?: string }).id || '')
              : String(rawAssignedTo || '');

          const taskId = String(taskRecord.id || '');
          const taskAttachments = allAttachments.filter(
            (att) => String(att.verificationTaskId || '') === taskId
          );
          const fallbackAttachments =
            !taskAttachments.length && selectedTasks.length === 1
              ? allAttachments
              : taskAttachments;

          return {
            id: taskId,
            applicantType: String(
              taskRecord.applicantType ||
                taskRecord.applicantType ||
                caseFormData.applicantType ||
                ''
            ),
            verificationTypeId: taskRecord.verificationTypeId
              ? parseInt(String(taskRecord.verificationTypeId), 10)
              : taskRecord.verificationTypeId
                ? parseInt(String(taskRecord.verificationTypeId), 10)
                : null,
            rateTypeId: String(taskRecord.rateTypeId || taskRecord.rateTypeId || ''),
            pincodeId: (() => {
              const taskPincodeCode = String(taskRecord.pincode || '');
              const found = pincodes.find((p) => p.code === taskPincodeCode);
              return found?.id?.toString() || '';
            })(),
            areaId: String(taskRecord.areaId || taskRecord.areaId || ''),
            address: String(taskRecord.address || ''),
            trigger: String(taskRecord.trigger || caseFormData.trigger || ''),
            priority: String(taskRecord.priority || caseFormData.priority || 'MEDIUM') as
              | 'LOW'
              | 'MEDIUM'
              | 'HIGH'
              | 'URGENT',
            assignedTo: assignedToId,
            documentType: String(taskRecord.documentType || taskRecord.documentType || ''),
            documentNumber: String(taskRecord.documentNumber || taskRecord.documentNumber || ''),
            attachments: fallbackAttachments.map(mapAttachment),
          };
        });

        const mappedData = {
          customerInfo,
          caseFormData, // Keeping for reference
          caseLevelData: {
            clientId: caseFormData.clientId,
            productId: caseFormData.productId,
            backendContactNumber: caseFormData.backendContactNumber,
            createdByBackendUser: caseFormData.createdByBackendUser,
          },
          tasks: mappedTasks,
        };

        logger.warn('✅ NewCasePage - Mapped data ready', {
          mappedTaskCount: mappedData.tasks.length,
          firstTaskRateTypeId: mappedData.tasks[0]?.rateTypeId,
          firstTaskAssignedTo: mappedData.tasks[0]?.assignedTo,
        });

        setInitialData(mappedData);
      }
    } catch (error) {
      // Only log errors in development mode
      if (import.meta.env.DEV) {
        logger.error('Error in NewCasePage useEffect:', error);
      }
      // Don't redirect on error, just log it
    }
  }, [
    isEditMode,
    caseData,
    pincodesResponse,
    areasResponse,
    verificationTasksResponse,
    caseAttachmentsResponse,
    editCaseId,
    editTaskId,
  ]);

  const handleSuccess = (caseId: string) => {
    if (caseId && caseId.trim() !== '') {
      navigate(`/case-management/${caseId}`);
    } else {
      // No id returned — route to the list so the user sees the new case at the top.
      navigate('/case-management/all-cases');
    }
  };

  const handleCancel = () => {
    navigate('/case-management/all-cases');
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-red-600">
            Edit Mode - No Data
          </h1>
          <div className="text-gray-600 space-y-2">
            <p>Edit Case ID: {editCaseId}</p>
            <p>Loading: {loadingCase ? 'Yes' : 'No'}</p>
            <p>Has Case Data: {caseData?.data ? 'Yes' : 'No'}</p>
            <div>
              <p>Case Data:</p>
              <pre className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded text-xs overflow-auto max-h-40 text-left">
                {JSON.stringify(caseData, null, 2) || 'null'}
              </pre>
            </div>
          </div>
          <Button onClick={() => navigate('/case-management/all-cases')} className="mt-4">
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
  const hasPendingTasks =
    (caseData?.data?.pendingTasks || 0) > 0 || (caseData?.data?.inProgressTasks || 0) > 0;
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
              This case has been marked as completed and can no longer be edited. If you need to
              make changes, please contact your administrator.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate(-1)} variant="outline">
                Go Back
              </Button>
              <Button onClick={() => navigate(`/cases/${editCaseId}`)}>View Case Details</Button>
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
            : 'Follow the steps below to create a new verification case with duplicate detection.'}
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
