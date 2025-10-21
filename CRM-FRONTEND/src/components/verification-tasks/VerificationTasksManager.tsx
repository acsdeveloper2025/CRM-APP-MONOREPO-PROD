import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useVerificationTasks } from '@/hooks/useVerificationTasks';
import { VerificationTasksList } from './VerificationTasksList';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskAssignmentModal } from './TaskAssignmentModal';
import { TaskCompletionModal } from './TaskCompletionModal';
import { TaskFilters } from './TaskFilters';
import { TaskSummaryCards } from './TaskSummaryCards';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { 
  Plus, 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Users,
  TrendingUp
} from 'lucide-react';
import { TaskStatus, TaskPriority } from '@/types/verificationTask';

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
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const {
    tasks,
    loading,
    error,
    selectedTasks,
    summary,
    fetchTasksForCase,
    refreshTasks,
    createMultipleTasks,
    assignTask,
    completeTask,
    bulkAssignTasks,
    selectTask,
    selectAllTasks,
    clearSelection,
    getTasksByStatus,
    setFilters,
    clearFilters
  } = useVerificationTasks(caseId);

  // Auto-fetch tasks when component mounts
  useEffect(() => {
    if (caseId) {
      fetchTasksForCase(caseId);
    }
  }, [caseId, fetchTasksForCase]);

  // Get tasks by status for tabs
  const pendingTasks = getTasksByStatus('PENDING');
  const assignedTasks = getTasksByStatus('ASSIGNED');
  const inProgressTasks = getTasksByStatus('IN_PROGRESS');
  const completedTasks = getTasksByStatus('COMPLETED');
  const cancelledTasks = getTasksByStatus('CANCELLED');

  // Handle task actions
  const handleCreateTasks = async (taskData: any[]) => {
    const success = await createMultipleTasks(caseId, taskData);
    if (success) {
      setShowCreateModal(false);
    }
  };

  const handleAssignTask = async (assignmentData: any) => {
    if (selectedTaskId) {
      const success = await assignTask(selectedTaskId, assignmentData);
      if (success) {
        setShowAssignModal(false);
        setSelectedTaskId(null);
      }
    }
  };

  const handleCompleteTask = async (completionData: any) => {
    if (selectedTaskId) {
      const success = await completeTask(selectedTaskId, completionData);
      if (success) {
        setShowCompleteModal(false);
        setSelectedTaskId(null);
      }
    }
  };

  const handleBulkAssign = async (assignedTo: string, reason?: string) => {
    const success = await bulkAssignTasks(selectedTasks, assignedTo, reason);
    if (success) {
      clearSelection();
    }
  };

  const handleRefresh = () => {
    refreshTasks();
  };

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
      case 'cancelled':
        return cancelledTasks;
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
            <span>Error loading verification tasks: {error}</span>
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

      {/* Filters */}
      {showFilters && (
        <TaskFilters
          onFiltersChange={setFilters}
          onClearFilters={clearFilters}
        />
      )}

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
              <TabsTrigger value="cancelled" className="text-xs">
                Cancelled ({cancelledTasks.length})
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
            onAssignTask={(taskId) => {
              setSelectedTaskId(taskId);
              setShowAssignModal(true);
            }}
            onCompleteTask={(taskId) => {
              setSelectedTaskId(taskId);
              setShowCompleteModal(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          caseId={caseId}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTasks}
        />
      )}

      {showAssignModal && selectedTaskId && (
        <TaskAssignmentModal
          taskId={selectedTaskId}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedTaskId(null);
          }}
          onSubmit={handleAssignTask}
        />
      )}

      {showCompleteModal && selectedTaskId && (
        <TaskCompletionModal
          taskId={selectedTaskId}
          onClose={() => {
            setShowCompleteModal(false);
            setSelectedTaskId(null);
          }}
          onSubmit={handleCompleteTask}
        />
      )}
    </div>
  );
};
