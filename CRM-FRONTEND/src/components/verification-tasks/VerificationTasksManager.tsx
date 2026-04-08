import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVerificationTasks } from '@/hooks/useVerificationTasks';
import { VerificationTasksService } from '@/services/verificationTasks';
import { logger } from '@/utils/logger';
import { VerificationTasksList } from './VerificationTasksList';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskAssignmentModal } from './TaskAssignmentModal';
import { TaskCompletionModal } from './TaskCompletionModal';
import { TaskSummaryCards } from './TaskSummaryCards';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import {
  Plus,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface VerificationTasksManagerProps {
  caseId: string;
  caseNumber?: string;
  customerName?: string;
  readonly?: boolean;
}

export const VerificationTasksManager: React.FC<VerificationTasksManagerProps> = ({
  caseId,
  caseNumber,
  customerName,
  readonly = false
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Use the actual hook structure
  const { data, isLoading, error, refetch } = useVerificationTasks(caseId);
  
  const tasks = data?.tasks || [];
  const loading = isLoading;

  // Helper function to filter tasks by status
  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  // Get tasks by status for tabs
  const pendingTasks = getTasksByStatus('PENDING');
  const assignedTasks = getTasksByStatus('ASSIGNED');
  const inProgressTasks = getTasksByStatus('IN_PROGRESS');
  const completedTasks = getTasksByStatus('COMPLETED');
  const revokedTasks = getTasksByStatus('REVOKED');

  // Calculate summary
  const summary = {
    totalTasks: data?.totalTasks ?? tasks.length,
    completedTasks: data?.completedTasks ?? completedTasks.length,
    completionPercentage:
      data?.completionPercentage ??
      (tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0),
  };

  // Selection handlers
  const selectTask = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAllTasks = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(t => t.id));
    }
  };

  const clearSelection = () => {
    setSelectedTasks([]);
  };

  // Handle task actions
  const handleCreateTasks = async (_taskData: unknown[]) => {
    logger.warn('Not yet implemented: Create tasks');
    setShowCreateModal(false);
  };

  const handleAssignTask = async (_assignmentData: unknown) => {
    logger.warn('Not yet implemented: Assign task');
    setShowAssignModal(false);
    setSelectedTaskId(null);
  };

  const handleCompleteTask = async (_completionData: unknown) => {
    logger.warn('Not yet implemented: Complete task');
    setShowCompleteModal(false);
    setSelectedTaskId(null);
  };

  const handleBulkAssign = async (_assignedTo: string, _reason?: string) => {
    logger.warn('Not yet implemented: Bulk assign tasks');
    clearSelection();
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await VerificationTasksService.startTask(taskId);
      toast.success('Task moved to In Progress');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start task');
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await VerificationTasksService.cancelTask(taskId, 'Revoked from case view');
      toast.success('Task revoked successfully');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke task');
    }
  };

  const handleViewTask = useCallback((taskId: string) => {
    navigate(`/tasks/${taskId}`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleOpenAssignModal = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setShowAssignModal(true);
  }, []);

  const handleOpenCompleteModal = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setShowCompleteModal(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleCloseAssignModal = useCallback(() => {
    setShowAssignModal(false);
    setSelectedTaskId(null);
  }, []);

  const handleCloseCompleteModal = useCallback(() => {
    setShowCompleteModal(false);
    setSelectedTaskId(null);
  }, []);

  // Filter tasks based on active tab
  const getFilteredTasks = () => {
    switch (activeTab) {
      case 'pending':
        return pendingTasks;
      case 'assigned':
        return assignedTasks;
      case 'in-progress':
        return inProgressTasks;
      case 'completed':
        return completedTasks;
      case 'revoked':
        return revokedTasks;
      default:
        return tasks;
    }
  };

  const filteredTasks = getFilteredTasks();

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Error loading verification tasks: {(error as Error).message}</span>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm" 
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Verification Tasks
          </h2>
          {caseNumber && customerName && (
            <p className="text-sm text-gray-600 mt-1">
              Case #{caseNumber} - {customerName}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {!readonly && (
            <Button
              onClick={() => setShowCreateModal(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tasks
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <TaskSummaryCards
        totalTasks={summary.totalTasks}
        completedTasks={summary.completedTasks}
        completionPercentage={summary.completionPercentage}
        pendingCount={pendingTasks.length}
        assignedCount={assignedTasks.length}
        inProgressCount={inProgressTasks.length}
      />

      {/* Bulk Actions */}
      {selectedTasks.length > 0 && !readonly && (
        <BulkActionsToolbar
          selectedCount={selectedTasks.length}
          onBulkAssign={handleBulkAssign}
          onClearSelection={clearSelection}
        />
      )}

      {/* Tasks Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all" className="text-xs">
                All ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                Pending ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs">
                Assigned ({assignedTasks.length})
              </TabsTrigger>
              <TabsTrigger value="in-progress" className="text-xs">
                In Progress ({inProgressTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                Completed ({completedTasks.length})
              </TabsTrigger>
              <TabsTrigger value="revoked" className="text-xs">
                Revoked ({revokedTasks.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          <VerificationTasksList
            tasks={filteredTasks}
            loading={loading}
            selectedTasks={selectedTasks}
            readonly={readonly}
            onSelectTask={selectTask}
            onSelectAll={selectAllTasks}
            onAssignTask={handleOpenAssignModal}
            onCompleteTask={handleOpenCompleteModal}
            onStartTask={handleStartTask}
            onCancelTask={handleCancelTask}
            onViewTask={handleViewTask}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          caseId={caseId}
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateTasks}
        />
      )}

      {showAssignModal && selectedTaskId && (
        <TaskAssignmentModal
          taskId={selectedTaskId}
          onClose={handleCloseAssignModal}
          onSubmit={handleAssignTask}
        />
      )}

      {showCompleteModal && selectedTaskId && (
        <TaskCompletionModal
          taskId={selectedTaskId}
          onClose={handleCloseCompleteModal}
          onSubmit={handleCompleteTask}
        />
      )}
    </div>
  );
};
