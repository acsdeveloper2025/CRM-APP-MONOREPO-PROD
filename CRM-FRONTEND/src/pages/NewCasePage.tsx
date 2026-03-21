import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CaseCreationStepper } from '@/components/cases/CaseCreationStepper';
import { useCase } from '@/hooks/useCases';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { useQuery } from '@tanstack/react-query';
import { attachmentsService } from '@/services/attachments';
import type { CustomerInfoData } from '@/components/cases/CustomerInfoStep';
import type { FullCaseFormData } from '@/components/cases/FullCaseFormStep';
import type { VerificationTask } from '@/types/verificationTask';
import type { TaskFormData, CaseLevelFormData } from '@/components/cases/TaskCaseCreationForm';
import type { CaseFormAttachment } from '@/components/attachments/CaseFormAttachmentsSection';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Skeleton } from '@/ui/components/Skeleton';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editCaseId = searchParams.get('edit');
  const editTaskId = searchParams.get('taskId'); // Get the specific task ID to edit
  const isEditMode = !!editCaseId;


  const [initialData, setInitialData] = useState<{
    customerInfo?: CustomerInfoData;
    caseFormData?: FullCaseFormData; // Keeping for backward compatibility if needed, but mainly using new structure
    caseLevelData?: CaseLevelFormData;
    tasks?: TaskFormData[];
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
  
  const { data: caseAttachmentsResponse } = useQuery({
    queryKey: ['case-attachments', editCaseId],
    queryFn: async () => attachmentsService.getAttachmentsByCase(editCaseId || ''),
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
      const tasks = verificationTasksResponse?.data?.tasks || [];
      const selectedTask = editTaskId
        ? tasks.find((t: VerificationTask) => t.id === editTaskId)
        : tasks[0];
      const taskPincodeCode = (selectedTask as unknown as Record<string, unknown>)?.pincode as string | undefined;
      const effectivePincodeCode = taskPincodeCode || caseItem.pincode;

      // Find pincode ID based on task-level pincode code first
      const foundPincode = pincodes.find(p => p.code === effectivePincodeCode);
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
          console.error('❌ No tasks found for case in edit mode', { editTaskId, caseId: editCaseId });
          return;
        }

        // If taskId is provided, edit that single task; otherwise map all tasks for case edit
        const selectedTasks = editTaskId
          ? tasks.filter((t: VerificationTask) => t.id === editTaskId)
          : tasks;

        if (!selectedTasks.length) {
          console.error('❌ Task not found', {
            editTaskId,
            availableTasks: tasks.map((t: VerificationTask) => t.id),
          });
          return;
        }

        const firstTask = selectedTasks[0] as unknown as Record<string, unknown>;
        const taskAddress = firstTask?.address || '';

        console.warn('🔍 NewCasePage - Mapping case data for edit mode', {
          caseId: editCaseId,
          taskId: editTaskId || firstTask?.id,
          firstTask,
          rate_type_id: firstTask?.rate_type_id,
          assigned_to: firstTask?.assigned_to,
        });

        const taskPincodeCode = firstTask?.pincode as string | undefined;
        const effectivePincodeCode = taskPincodeCode || String(caseItem.pincode || '');

        // Find pincode ID based on task-level pincode code first
        const foundPincode = pincodes.find(p => p.code === effectivePincodeCode);
        const pincodeId = foundPincode?.id?.toString() || '';

        // Use task-level area_id directly when available
        const taskAreaId = firstTask?.area_id || firstTask?.areaId;
        const areaId = taskAreaId ? String(taskAreaId) : '';

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
          address: String(addressValue),
          pincodeId, // Map pincode code to pincode ID
          areaId, // Use the found area ID
        };

        const allAttachments = (caseAttachmentsResponse?.data || []) as Record<string, unknown>[];
        const mapAttachment = (att: Record<string, unknown>): CaseFormAttachment => {
          const fileName = String(att.originalName || att.filename || 'attachment');
          const mimeType = String(att.mimeType || 'application/octet-stream');
          const size = Number(att.size || 0);
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
          const rawAssignedTo = taskRecord.assigned_to || taskRecord.assignedTo;
          const assignedToId = typeof rawAssignedTo === 'object' && rawAssignedTo
            ? String((rawAssignedTo as { id?: string }).id || '')
            : String(rawAssignedTo || '');

          const taskId = String(taskRecord.id || '');
          const taskAttachments = allAttachments.filter(
            att => String(att.verification_task_id || '') === taskId
          );
          const fallbackAttachments = !taskAttachments.length && selectedTasks.length === 1
            ? allAttachments
            : taskAttachments;

          return {
            id: taskId,
            applicantType: String(taskRecord.applicant_type || taskRecord.applicantType || caseFormData.applicantType || ''),
            verificationTypeId: taskRecord.verification_type_id
              ? parseInt(String(taskRecord.verification_type_id), 10)
              : taskRecord.verificationTypeId
                ? parseInt(String(taskRecord.verificationTypeId), 10)
                : null,
            rateTypeId: String(taskRecord.rate_type_id || taskRecord.rateTypeId || ''),
            pincodeId: (() => {
              const taskPincodeCode = String(taskRecord.pincode || '');
              const found = pincodes.find(p => p.code === taskPincodeCode);
              return found?.id?.toString() || '';
            })(),
            areaId: String(taskRecord.area_id || taskRecord.areaId || ''),
            address: String(taskRecord.address || ''),
            trigger: String(taskRecord.trigger || caseFormData.trigger || ''),
            priority: (String(taskRecord.priority || caseFormData.priority || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'),
            assignedTo: assignedToId,
            documentType: String(taskRecord.document_type || taskRecord.documentType || ''),
            documentNumber: String(taskRecord.document_number || taskRecord.documentNumber || ''),
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
          tasks: mappedTasks
        };

        console.warn('✅ NewCasePage - Mapped data ready', {
          mappedTaskCount: mappedData.tasks.length,
          firstTaskRateTypeId: mappedData.tasks[0]?.rateTypeId,
          firstTaskAssignedTo: mappedData.tasks[0]?.assignedTo,
        });

        setInitialData(mappedData);
      }
    } catch (error) {
      // Only log errors in development mode
      if (import.meta.env.DEV) {
        console.error('Error in NewCasePage useEffect:', error);
      }
      // Don't redirect on error, just log it
    }

  }, [isEditMode, caseData, pincodesResponse, areasResponse, verificationTasksResponse, caseAttachmentsResponse, editCaseId, editTaskId]);

  const handleSuccess = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const handleCancel = () => {
    navigate('/cases');
  };



  if (isEditMode && loadingCase) {
    return (
      <Page title="Edit Case" subtitle={`Loading case data... (ID: ${editCaseId})`} shell>
        <Section>
          <Stack gap={3} align="center" style={{ padding: '48px 0' }}>
            <Skeleton style={{ width: 60, height: 60, borderRadius: 999 }} />
            <Text variant="body" tone="muted">Fetching case data...</Text>
          </Stack>
        </Section>
      </Page>
    );
  }

  // Debug: Show if we're in edit mode but have no data
  if (isEditMode && !loadingCase && !caseData?.data) {
    return (
      <Page title="Edit Case" subtitle="Edit mode could not load case data." shell>
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={3} style={{ textAlign: 'center' }}>
              <Text as="h2" variant="headline" tone="danger">Edit Mode - No Data</Text>
              <Stack gap={2}>
                <Text tone="muted">Edit Case ID: {editCaseId}</Text>
                <Text tone="muted">Loading: {loadingCase ? 'Yes' : 'No'}</Text>
                <Text tone="muted">Has Case Data: {caseData?.data ? 'Yes' : 'No'}</Text>
            <div>
                  <Text variant="body-sm">Case Data:</Text>
              <pre {...{ className: "bg-slate-100 dark:bg-slate-800/60 p-2 rounded text-xs overflow-auto max-h-40 text-left" }}>
                {JSON.stringify(caseData, null, 2) || 'null'}
              </pre>
            </div>
              </Stack>
              <div>
                <Button onClick={() => navigate('/cases')}>
                  Back to Cases
                </Button>
              </div>
            </Stack>
          </Card>
        </Section>
      </Page>
    );
  }

  // Don't render the form in edit mode until we have initial data
  if (isEditMode && !initialData) {
    return (
      <Page title="Edit Case" subtitle={`Preparing form data... (ID: ${editCaseId})`} shell>
        <Section>
          <Stack gap={3} align="center" style={{ padding: '48px 0' }}>
            <Skeleton style={{ width: 60, height: 60, borderRadius: 999 }} />
            <Text variant="body" tone="muted">Preparing form data...</Text>
          </Stack>
        </Section>
      </Page>
    );
  }

  // Prevent editing completed cases ONLY if there are no pending/in-progress tasks
  // This handles cases where the status might be cached but revisit tasks exist
  const hasPendingTasks = (caseData?.data?.pendingTasks || 0) > 0 || (caseData?.data?.inProgressTasks || 0) > 0;
  const isCompleted = caseData?.data?.status === 'COMPLETED' && !hasPendingTasks;
  
  if (isEditMode && isCompleted) {
    return (
      <Page title="Edit Case" subtitle="Completed cases can no longer be changed." shell>
        <Section>
          <Card tone="strong" staticCard>
            <Stack gap={3} style={{ textAlign: 'center', maxWidth: '34rem', margin: '0 auto' }}>
              <div>
                <Badge variant="status-completed">Completed</Badge>
              </div>
              <Text as="h2" variant="headline">Cannot Edit Completed Case</Text>
              <Text tone="muted">
              This case has been marked as completed and can no longer be edited.
              If you need to make changes, please contact your administrator.
              </Text>
              <Stack direction="horizontal" gap={2} justify="center" wrap="wrap">
                <Button onClick={() => navigate(-1)} variant="secondary">
                Go Back
              </Button>
              <Button onClick={() => navigate(`/cases/${editCaseId}`)}>
                View Case Details
              </Button>
              </Stack>
            </Stack>
          </Card>
        </Section>
      </Page>
    );
  }



  return (
    <Page
      title={isEditMode ? 'Edit Case' : 'Create New Case'}
      subtitle={
        isEditMode
          ? 'Update the case details using the form below.'
          : 'Follow the steps below to create a new verification case with duplicate detection.'
      }
      shell
    >
      <Section>
        <Stack gap={3}>
          <Badge variant={isEditMode ? 'warning' : 'accent'}>
            {isEditMode ? 'Edit Workflow' : 'Case Intake'}
          </Badge>
          <Text as="h2" variant="headline">
            {isEditMode ? 'Resume case editing in the shared shell.' : 'Create a new case without changing the existing stepper logic.'}
          </Text>
        </Stack>
      </Section>

      <Section>
        <CaseCreationStepper
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        editMode={isEditMode}
        editCaseId={editCaseId || undefined}
        initialData={initialData}
      />
      </Section>
    </Page>
  );
};
