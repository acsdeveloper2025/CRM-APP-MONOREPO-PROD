import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { LoadingSkeleton } from '@/ui/components/loading';
import { EditTaskDetailsModal } from '@/components/verification-tasks/EditTaskDetailsModal';
import {
  TaskAssignmentHistoryCard,
  TaskAssignmentHistoryItem,
  TaskDetailHeader,
  TaskDetailRecord,
  TaskInformationCard,
  TaskSidebar,
} from '@/components/verification-tasks/TaskDetailPanels';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Grid } from '@/ui/layout/Grid';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';
import { Card } from '@/ui/components/Card';
import { Button } from '@/ui/components/Button';

interface TaskHistoryItem {
  id: string;
  details: {
    to?: string;
    from?: string;
    comment?: string;
    status?: string;
  };
  performedBy: {
    name: string;
  };
  timestamp: string;
}


export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailRecord | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<TaskAssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);


  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
      fetchAssignmentHistory();
    }
     
  }, [taskId]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/verification-tasks/${taskId}`);

      if (response.success) {
        // Transform snake_case to camelCase
                 
        const taskData = response.data as any;
        setTask({
          id: taskData.id,
          taskNumber: taskData.task_number,
          caseId: taskData.case_id,
          caseNumber: taskData.case_number,
          customerName: taskData.customer_name,
          verificationTypeName: taskData.verification_type_name,
          taskTitle: taskData.task_title,
          taskDescription: taskData.task_description,
          priority: taskData.priority,
          status: taskData.status,
          assignedToName: taskData.assigned_to_name,
          assignedToEmployeeId: taskData.assigned_to_employee_id,
          assignedByName: taskData.assigned_by_name,
          assignedAt: taskData.assigned_at,
          startedAt: taskData.started_at,
          completedAt: taskData.completed_at,
          estimatedAmount: taskData.estimated_amount,
          actualAmount: taskData.actual_amount,
          address: taskData.address,
          pincode: taskData.pincode,
          rateTypeName: taskData.rate_type_name,
          trigger: taskData.trigger,
          applicantType: taskData.applicant_type,
          verificationOutcome: taskData.verification_outcome,
          commissionStatus: taskData.commission_status,
          calculatedCommission: taskData.calculated_commission,
          documentType: taskData.document_type,
          documentNumber: taskData.document_number,
          createdAt: taskData.created_at,
          updatedAt: taskData.updated_at,
        });
      }
      setLoading(false);
    } catch (err) {
      const errorMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to fetch task details';
      setError(errorMessage);
      setLoading(false);
      toast.error(errorMessage);
    }
  };

  const fetchAssignmentHistory = async () => {
    try {
      const response = await apiService.get(`/verification-tasks/${taskId}/assignment-history`);

      if (response.success) {
        const history = (response.data as TaskHistoryItem[]).map((item: TaskHistoryItem) => ({
          id: item.id,
          assignedToName: item.details.to || 'N/A', // Assuming 'to' in details is the assignedToName
          assignedByName: item.performedBy.name,
          assignedFromName: item.details.from, // Assuming 'from' in details is the assignedFromName
          assignedAt: item.timestamp,
          assignmentReason: item.details.comment,
          taskStatusAfter: item.details.status || 'N/A', // Assuming status is in details
        }));
        setAssignmentHistory(history);
      }
    } catch (err) {
      console.error('Failed to fetch assignment history:', err);
    }
  };

  const handleUpdateTask = async (taskId: string, updateData: import('@/types/verificationTask').UpdateVerificationTaskRequest) => {
    try {
      const response = await apiService.put(`/verification-tasks/${taskId}`, updateData);
      if (response.success) {
        toast.success('Task details updated successfully');
        fetchTaskDetails(); // Refresh data
      } else {
        toast.error(response.message || 'Failed to update task');
      }
    } catch (error) {
       console.error('Failed to update task:', error);
       toast.error('An error occurred while updating the task');
    }
  };

  if (loading) {
    return (
      <Page title="Task detail" subtitle="Loading operational detail..." shell>
        <Section>
          <Stack gap={4}>
            <LoadingSkeleton height="120px" {...{ className: "rounded-[28px]" }} />
            <Grid min={280}>
              <LoadingSkeleton height="320px" {...{ className: "rounded-[28px]" }} />
              <LoadingSkeleton height="320px" {...{ className: "rounded-[28px]" }} />
            </Grid>
          </Stack>
        </Section>
      </Page>
    );
  }

  if (error || !task) {
    return (
      <Page title="Task detail" subtitle="Task record unavailable." shell>
        <Section>
          <Card tone="muted" staticCard>
            <Stack gap={3}>
              <Text as="h2" variant="headline" tone="danger">Task not found</Text>
              <Text variant="body-sm" tone="muted">{error || 'The requested task is unavailable.'}</Text>
              <div>
                <Button variant="secondary" onClick={() => navigate('/tasks')}>
                  Back to tasks
                </Button>
              </div>
            </Stack>
          </Card>
        </Section>
      </Page>
    );
  }

  return (
    <Page
      title={task.taskNumber}
      subtitle={task.taskTitle}
      shell
    >
      <Section>
        <TaskDetailHeader
          task={task}
          onBack={() => navigate('/tasks')}
          onEdit={() => setIsEditModalOpen(true)}
        />
      </Section>

      <EditTaskDetailsModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        task={{
            id: task.id,
            taskTitle: task.taskTitle,
            taskDescription: task.taskDescription,
            priority: task.priority,
            address: task.address,
            pincode: task.pincode,
            // Add if available in task object, otherwise defaults to empty
            documentType: task.documentType,
            documentNumber: task.documentNumber
        }}
        onSubmit={handleUpdateTask}
      />

      <Section>
        <Grid min={320} style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 0.8fr)' }}>
          <Stack gap={4}>
            <TaskInformationCard
              task={task}
              onOpenCase={() => navigate(`/cases/${task.caseId}`)}
            />
            <TaskAssignmentHistoryCard history={assignmentHistory} />
          </Stack>
          <TaskSidebar task={task} />
        </Grid>
      </Section>
    </Page>
  );
};
