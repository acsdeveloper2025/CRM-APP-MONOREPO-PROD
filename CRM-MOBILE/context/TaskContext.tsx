import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { VerificationTask, TaskStatus, VerificationOutcome, ResidenceReportData, ShiftedResidenceReportData, NspResidenceReportData, EntryRestrictedResidenceReportData, UntraceableResidenceReportData, ResiCumOfficeReportData, ShiftedResiCumOfficeReportData, NspResiCumOfficeReportData, EntryRestrictedResiCumOfficeReportData, UntraceableResiCumOfficeReportData, PositiveOfficeReportData, ShiftedOfficeReportData, NspOfficeReportData, EntryRestrictedOfficeReportData, UntraceableOfficeReportData, PositiveBusinessReportData, ShiftedBusinessReportData, NspBusinessReportData, EntryRestrictedBusinessReportData, UntraceableBusinessReportData, PositiveBuilderReportData, ShiftedBuilderReportData, NspBuilderReportData, EntryRestrictedBuilderReportData, UntraceableBuilderReportData, PositiveNocReportData, ShiftedNocReportData, NspNocReportData, EntryRestrictedNocReportData, UntraceableNocReportData, PositiveDsaReportData, ShiftedDsaReportData, NspDsaReportData, EntryRestrictedDsaReportData, UntraceableDsaReportData, PositivePropertyApfReportData, NspPropertyApfReportData, EntryRestrictedPropertyApfReportData, UntraceablePropertyApfReportData, PositivePropertyIndividualReportData, NspPropertyIndividualReportData, EntryRestrictedPropertyIndividualReportData, UntraceablePropertyIndividualReportData, RevokeReason } from '../types';
import { taskService } from "../services/taskService"
import { priorityService } from '../services/priorityService';
import TaskStatusService from "../services/taskStatusService"
import AuditService from '../services/auditService';
import AuthStorageService from '../services/authStorageService';
import NetworkService from '../services/networkService';
import CaseCounterService from '../services/caseCounterService';
import { useAuth } from './AuthContext';
import { getReportInfo } from '../data/initialReportData';
import EnterpriseOfflineDatabase from '../src/services/EnterpriseOfflineDatabase';

interface TaskContextType {
  tasks: VerificationTask[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  fetchTasks: () => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateVerificationOutcome: (taskId: string, outcome: VerificationOutcome | null) => Promise<void>;
  updateResidenceReport: (taskId: string, reportData: Partial<ResidenceReportData>) => Promise<void>;
  updateShiftedResidenceReport: (taskId: string, reportData: Partial<ShiftedResidenceReportData>) => Promise<void>;
  updateNspResidenceReport: (taskId: string, reportData: Partial<NspResidenceReportData>) => Promise<void>;
  updateEntryRestrictedResidenceReport: (taskId: string, reportData: Partial<EntryRestrictedResidenceReportData>) => Promise<void>;
  updateUntraceableResidenceReport: (taskId: string, reportData: Partial<UntraceableResidenceReportData>) => Promise<void>;
  updateResiCumOfficeReport: (taskId: string, reportData: Partial<ResiCumOfficeReportData>) => Promise<void>;
  updateShiftedResiCumOfficeReport: (taskId: string, reportData: Partial<ShiftedResiCumOfficeReportData>) => Promise<void>;
  updateNspResiCumOfficeReport: (taskId: string, reportData: Partial<NspResiCumOfficeReportData>) => Promise<void>;
  updateEntryRestrictedResiCumOfficeReport: (taskId: string, reportData: Partial<EntryRestrictedResiCumOfficeReportData>) => Promise<void>;
  updateUntraceableResiCumOfficeReport: (taskId: string, reportData: Partial<UntraceableResiCumOfficeReportData>) => Promise<void>;
  updatePositiveOfficeReport: (taskId: string, reportData: Partial<PositiveOfficeReportData>) => Promise<void>;
  updateShiftedOfficeReport: (taskId: string, reportData: Partial<ShiftedOfficeReportData>) => Promise<void>;
  updateNspOfficeReport: (taskId: string, reportData: Partial<NspOfficeReportData>) => Promise<void>;
  updateEntryRestrictedOfficeReport: (taskId: string, reportData: Partial<EntryRestrictedOfficeReportData>) => Promise<void>;
  updateUntraceableOfficeReport: (taskId: string, reportData: Partial<UntraceableOfficeReportData>) => Promise<void>;
  updatePositiveBusinessReport: (taskId: string, reportData: Partial<PositiveBusinessReportData>) => Promise<void>;
  updateShiftedBusinessReport: (taskId: string, reportData: Partial<ShiftedBusinessReportData>) => Promise<void>;
  updateNspBusinessReport: (taskId: string, reportData: Partial<NspBusinessReportData>) => Promise<void>;
  updateEntryRestrictedBusinessReport: (taskId: string, reportData: Partial<EntryRestrictedBusinessReportData>) => Promise<void>;
  updateUntraceableBusinessReport: (taskId: string, reportData: Partial<UntraceableBusinessReportData>) => Promise<void>;
  updatePositiveBuilderReport: (taskId: string, reportData: Partial<PositiveBuilderReportData>) => Promise<void>;
  updateShiftedBuilderReport: (taskId: string, reportData: Partial<ShiftedBuilderReportData>) => Promise<void>;
  updateNspBuilderReport: (taskId: string, reportData: Partial<NspBuilderReportData>) => Promise<void>;
  updateEntryRestrictedBuilderReport: (taskId: string, reportData: Partial<EntryRestrictedBuilderReportData>) => Promise<void>;
  updateUntraceableBuilderReport: (taskId: string, reportData: Partial<UntraceableBuilderReportData>) => Promise<void>;
  updatePositiveNocReport: (taskId: string, reportData: Partial<PositiveNocReportData>) => Promise<void>;
  updateShiftedNocReport: (taskId: string, reportData: Partial<ShiftedNocReportData>) => Promise<void>;
  updateNspNocReport: (taskId: string, reportData: Partial<NspNocReportData>) => Promise<void>;
  updateEntryRestrictedNocReport: (taskId: string, reportData: Partial<EntryRestrictedNocReportData>) => Promise<void>;
  updateUntraceableNocReport: (taskId: string, reportData: Partial<UntraceableNocReportData>) => Promise<void>;
  updatePositiveDsaReport: (taskId: string, reportData: Partial<PositiveDsaReportData>) => Promise<void>;
  updateShiftedDsaReport: (taskId: string, reportData: Partial<ShiftedDsaReportData>) => Promise<void>;
  updateNspDsaReport: (taskId: string, reportData: Partial<NspDsaReportData>) => Promise<void>;
  updateEntryRestrictedDsaReport: (taskId: string, reportData: Partial<EntryRestrictedDsaReportData>) => Promise<void>;
  updateUntraceableDsaReport: (taskId: string, reportData: Partial<UntraceableDsaReportData>) => Promise<void>;
  updatePositivePropertyApfReport: (taskId: string, reportData: Partial<PositivePropertyApfReportData>) => Promise<void>;
  updateNspPropertyApfReport: (taskId: string, reportData: Partial<NspPropertyApfReportData>) => Promise<void>;
  updateEntryRestrictedPropertyApfReport: (taskId: string, reportData: Partial<EntryRestrictedPropertyApfReportData>) => Promise<void>;
  updateUntraceablePropertyApfReport: (taskId: string, reportData: Partial<UntraceablePropertyApfReportData>) => Promise<void>;
  updatePositivePropertyIndividualReport: (taskId: string, reportData: Partial<PositivePropertyIndividualReportData>) => Promise<void>;
  updateNspPropertyIndividualReport: (taskId: string, reportData: Partial<NspPropertyIndividualReportData>) => Promise<void>;
  updateEntryRestrictedPropertyIndividualReport: (taskId: string, reportData: Partial<EntryRestrictedPropertyIndividualReportData>) => Promise<void>;
  updateUntraceablePropertyIndividualReport: (taskId: string, reportData: Partial<UntraceablePropertyIndividualReportData>) => Promise<void>;
  toggleSaveTask: (taskId: string, isSaved: boolean) => Promise<void>;
  revokeTask: (taskId: string, reason: RevokeReason) => Promise<void>;
  reorderInProgressTask: (taskId: string, direction: 'up' | 'down') => Promise<void>;
  syncTasks: () => Promise<void>;
  // Priority management functions
  setTaskPriority: (taskId: string, priority: number | null) => void;
  getTaskPriority: (taskId: string) => number | null;
  getTasksWithPriorities: () => VerificationTask[];
  // Submission status management
  updateTaskSubmissionStatus: (taskId: string, status: 'pending' | 'submitting' | 'success' | 'failed', error?: string) => Promise<void>;
  verifyTaskSubmissionStatus: (taskId: string) => Promise<{ submitted: boolean; taskStatus?: string; error?: string }>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, user } = useAuth();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isOnline = NetworkService.isOnline();
      console.log(`📡 fetchTasks: Network status - ${isOnline ? 'Online' : 'Offline'}`);

      if (isOnline) {
        // ONLINE: Fetch from API and save to local DB
        try {
          const data = await taskService.getTasks(true);
          const sortedTasks = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          
          // Save to local DB for offline access
          try {
            for (const task of sortedTasks) {
              await EnterpriseOfflineDatabase.saveCase(task);
            }
            console.log(`💾 Saved ${sortedTasks.length} tasks to local database`);
          } catch (dbError) {
            console.error('❌ Failed to save tasks to local DB:', dbError);
          }
          
          setTasks(sortedTasks);
          await CaseCounterService.updateCounts(sortedTasks);
        } catch (apiError) {
          console.warn('⚠️ API fetch failed, falling back to local DB:', apiError);
          // API failed - fall back to local DB
          const localTasks = await EnterpriseOfflineDatabase.getCases({
            assignedTo: user?.id
          });
          const sortedLocalTasks = localTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setTasks(sortedLocalTasks);
          await CaseCounterService.updateCounts(sortedLocalTasks);
        }
      } else {
        // OFFLINE: Load from local DB
        console.log('📱 Working offline - loading tasks from local database');
        const localTasks = await EnterpriseOfflineDatabase.getCases({
          assignedTo: user?.id
        });
        const sortedLocalTasks = localTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setTasks(sortedLocalTasks);
        await CaseCounterService.updateCounts(sortedLocalTasks);
        console.log(`✅ Loaded ${sortedLocalTasks.length} tasks from local database`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(errorMessage);
      console.error('❌ fetchTasks error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [isAuthenticated, fetchTasks]);

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const currentTask = tasks.find(c => c.id === taskId);
      if (!currentTask) throw new Error("Case not found");

      // Optimistic update: Update local state immediately
      const updatedTasks = tasks.map(c =>
        c.id === taskId
          ? { 
              ...c, 
              status, 
              taskStatus: status, // FIX: Also update taskStatus to keep it in sync with status for correct tab filtering
              updatedAt: new Date().toISOString(),
              ...(status === TaskStatus.InProgress && !c.inProgressAt ? { inProgressAt: new Date().toISOString() } : {}),
              ...(status === TaskStatus.Completed ? { completedAt: new Date().toISOString(), submissionStatus: 'pending' as const, isSaved: false } : {})
            }
          : c
      );
      setTasks(updatedTasks);
      
      // Update task counters immediately with optimistic data
      await CaseCounterService.updateCounts(updatedTasks);

      // Prepare audit metadata
      const auditMetadata = {
        customerName: currentTask.customer.name,
        verificationType: currentTask.verificationType,
        caseTitle: currentTask.title,
        address: currentTask.address || currentTask.visitAddress,
        updatedAt: new Date().toISOString(),
        networkStatus: NetworkService.isOnline() ? 'online' : 'offline',
      };

      // Use enhanced task status service with optimistic UI and offline support
      const result = await TaskStatusService.updateTaskStatus(taskId, status, {
        optimistic: true,
        auditMetadata,
      });

      if (result.success) {
        // Log the status change for audit purposes
        await AuditService.logTaskStatusChange(
          taskId,
          currentTask.status,
          status,
          {
            customerName: currentTask.customer.name,
            verificationType: currentTask.verificationType,
            metadata: auditMetadata,
          }
        );

        // Record status change for counter tracking
        await CaseCounterService.recordStatusChange(taskId, currentTask.status, status);

        // Update completed successfully
      } else {
        throw new Error(result.error || 'Failed to update task status');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task status';
      setError(errorMessage);
      console.error(`❌ Error updating task ${taskId}:`, err);
      
      // Revert optimistic update on error by refetching
      fetchTasks();
    }
  };
  
  const updateVerificationOutcome = async (taskId: string, outcome: VerificationOutcome | null) => {
    try {
      const taskToUpdate = tasks.find(c => c.id === taskId);
      if (!taskToUpdate) {
        throw new Error("Task not found");
      }
  
      const updates: Partial<VerificationTask> = { verificationOutcome: outcome };
  
      if (outcome) {
        const reportInfo = getReportInfo(taskToUpdate.verificationType, outcome);
        
        // Check if the report key exists on the task object and is undefined/null
        if (reportInfo && !taskToUpdate[reportInfo.key as keyof VerificationTask]) {
          (updates as any)[reportInfo.key] = reportInfo.data;
        }
      }

      // Optimistic update: Update local state immediately
      const updatedTasks = tasks.map(c =>
        c.id === taskId
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      );
      setTasks(updatedTasks);

      await taskService.updateTask(taskId, updates);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update verification outcome';
      setError(errorMessage);
      console.error(`❌ Error updating verification outcome for task ${taskId}:`, err);
      // Revert on error
      fetchTasks();
    }
  };

  const updateResidenceReport = async (taskId: string, reportData: Partial<ResidenceReportData>) => {
    try {
      const taskToUpdate = tasks.find(c => c.id === taskId);
      if (!taskToUpdate) throw new Error("Task not found");
      const updatedReport = { ...(taskToUpdate.residenceReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevTasks => prevTasks.map(c =>
        c.id === taskId
          ? { ...c, residenceReport: updatedReport as ResidenceReportData, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
          : c
      ));

      await taskService.updateTask(taskId, { residenceReport: updatedReport as ResidenceReportData });
    } catch (err) {
      setError('Failed to update residence report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateShiftedResidenceReport = async (taskId: string, reportData: Partial<ShiftedResidenceReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedResidenceReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c =>
        c.id === taskId
          ? { ...c, shiftedResidenceReport: updatedReport as ShiftedResidenceReportData, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
          : c
      ));

      await taskService.updateTask(taskId, { shiftedResidenceReport: updatedReport as ShiftedResidenceReportData });
    } catch (err) {
      setError('Failed to update shifted residence report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateNspResidenceReport = async (taskId: string, reportData: Partial<NspResidenceReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspResidenceReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspResidenceReport: updatedReport as NspResidenceReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspResidenceReport: updatedReport as NspResidenceReportData });
    } catch (err) {
      setError('Failed to update NSP residence report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedResidenceReport = async (taskId: string, reportData: Partial<EntryRestrictedResidenceReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedResidenceReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedResidenceReport: updatedReport as EntryRestrictedResidenceReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedResidenceReport: updatedReport as EntryRestrictedResidenceReportData });
    } catch (err) {
      setError('Failed to update entry restricted residence report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateUntraceableResidenceReport = async (taskId: string, reportData: Partial<UntraceableResidenceReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableResidenceReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableResidenceReport: updatedReport as UntraceableResidenceReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableResidenceReport: updatedReport as UntraceableResidenceReportData });
    } catch (err) {
      setError('Failed to update untraceable residence report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateResiCumOfficeReport = async (taskId: string, reportData: Partial<ResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.resiCumOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, resiCumOfficeReport: updatedReport as ResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { resiCumOfficeReport: updatedReport as ResiCumOfficeReportData });
    } catch (err) {
      setError('Failed to update resi-cum-office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateShiftedResiCumOfficeReport = async (taskId: string, reportData: Partial<ShiftedResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedResiCumOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, shiftedResiCumOfficeReport: updatedReport as ShiftedResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { shiftedResiCumOfficeReport: updatedReport as ShiftedResiCumOfficeReportData });
    } catch (err) {
      setError('Failed to update shifted resi-cum-office report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateNspResiCumOfficeReport = async (taskId: string, reportData: Partial<NspResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspResiCumOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspResiCumOfficeReport: updatedReport as NspResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspResiCumOfficeReport: updatedReport as NspResiCumOfficeReportData });
    } catch (err) {
      setError('Failed to update NSP resi-cum-office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedResiCumOfficeReport = async (taskId: string, reportData: Partial<EntryRestrictedResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedResiCumOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedResiCumOfficeReport: updatedReport as EntryRestrictedResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedResiCumOfficeReport: updatedReport as EntryRestrictedResiCumOfficeReportData });
    } catch (err) {
      setError('Failed to update ERT resi-cum-office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateUntraceableResiCumOfficeReport = async (taskId: string, reportData: Partial<UntraceableResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableResiCumOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableResiCumOfficeReport: updatedReport as UntraceableResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableResiCumOfficeReport: updatedReport as UntraceableResiCumOfficeReportData });
    } catch (err) {
      setError('Failed to update untraceable resi-cum-office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updatePositiveOfficeReport = async (taskId: string, reportData: Partial<PositiveOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, positiveOfficeReport: updatedReport as PositiveOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { positiveOfficeReport: updatedReport as PositiveOfficeReportData });
    } catch (err) {
      setError('Failed to update positive office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateShiftedOfficeReport = async (taskId: string, reportData: Partial<ShiftedOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, shiftedOfficeReport: updatedReport as ShiftedOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { shiftedOfficeReport: updatedReport as ShiftedOfficeReportData });
    } catch (err) {
      setError('Failed to update shifted office report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateNspOfficeReport = async (taskId: string, reportData: Partial<NspOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspOfficeReport: updatedReport as NspOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspOfficeReport: updatedReport as NspOfficeReportData });
    } catch (err) {
      setError('Failed to update NSP office report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateEntryRestrictedOfficeReport = async (taskId: string, reportData: Partial<EntryRestrictedOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedOfficeReport: updatedReport as EntryRestrictedOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedOfficeReport: updatedReport as EntryRestrictedOfficeReportData });
    } catch (err) {
      setError('Failed to update ERT office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateUntraceableOfficeReport = async (taskId: string, reportData: Partial<UntraceableOfficeReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableOfficeReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableOfficeReport: updatedReport as UntraceableOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableOfficeReport: updatedReport as UntraceableOfficeReportData });
    } catch (err) {
      setError('Failed to update untraceable office report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updatePositiveBusinessReport = async (taskId: string, reportData: Partial<PositiveBusinessReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveBusinessReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c =>
        c.id === taskId
          ? { ...c, positiveBusinessReport: updatedReport as PositiveBusinessReportData, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
          : c
      ));

      await taskService.updateTask(taskId, { positiveBusinessReport: updatedReport as PositiveBusinessReportData });
    } catch (err) {
      setError('Failed to update positive business report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateShiftedBusinessReport = async (taskId: string, reportData: Partial<ShiftedBusinessReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedBusinessReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, shiftedBusinessReport: updatedReport as ShiftedBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { shiftedBusinessReport: updatedReport as ShiftedBusinessReportData });
    } catch (err) {
      setError('Failed to update shifted business report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateNspBusinessReport = async (taskId: string, reportData: Partial<NspBusinessReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspBusinessReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspBusinessReport: updatedReport as NspBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspBusinessReport: updatedReport as NspBusinessReportData });
    } catch (err) {
      setError('Failed to update NSP business report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedBusinessReport = async (taskId: string, reportData: Partial<EntryRestrictedBusinessReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedBusinessReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedBusinessReport: updatedReport as EntryRestrictedBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedBusinessReport: updatedReport as EntryRestrictedBusinessReportData });
    } catch (err) {
      setError('Failed to update ERT business report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateUntraceableBusinessReport = async (taskId: string, reportData: Partial<UntraceableBusinessReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableBusinessReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableBusinessReport: updatedReport as UntraceableBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableBusinessReport: updatedReport as UntraceableBusinessReportData });
    } catch (err) {
      setError('Failed to update untraceable business report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updatePositiveBuilderReport = async (taskId: string, reportData: Partial<PositiveBuilderReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveBuilderReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, positiveBuilderReport: updatedReport as PositiveBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { positiveBuilderReport: updatedReport as PositiveBuilderReportData });
    } catch (err) {
      setError('Failed to update positive builder report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateShiftedBuilderReport = async (taskId: string, reportData: Partial<ShiftedBuilderReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedBuilderReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, shiftedBuilderReport: updatedReport as ShiftedBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { shiftedBuilderReport: updatedReport as ShiftedBuilderReportData });
    } catch (err) {
      setError('Failed to update shifted builder report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateNspBuilderReport = async (taskId: string, reportData: Partial<NspBuilderReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspBuilderReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspBuilderReport: updatedReport as NspBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspBuilderReport: updatedReport as NspBuilderReportData });
    } catch (err) {
      setError('Failed to update NSP builder report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateEntryRestrictedBuilderReport = async (taskId: string, reportData: Partial<EntryRestrictedBuilderReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedBuilderReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedBuilderReport: updatedReport as EntryRestrictedBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedBuilderReport: updatedReport as EntryRestrictedBuilderReportData });
    } catch (err) {
      setError('Failed to update ERT builder report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateUntraceableBuilderReport = async (taskId: string, reportData: Partial<UntraceableBuilderReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableBuilderReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableBuilderReport: updatedReport as UntraceableBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableBuilderReport: updatedReport as UntraceableBuilderReportData });
    } catch (err) {
      setError('Failed to update untraceable builder report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updatePositiveNocReport = async (taskId: string, reportData: Partial<PositiveNocReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveNocReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, positiveNocReport: updatedReport as PositiveNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { positiveNocReport: updatedReport as PositiveNocReportData });
    } catch (err) {
      setError('Failed to update positive NOC report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateShiftedNocReport = async (taskId: string, reportData: Partial<ShiftedNocReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedNocReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, shiftedNocReport: updatedReport as ShiftedNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { shiftedNocReport: updatedReport as ShiftedNocReportData });
    } catch (err) {
      setError('Failed to update shifted NOC report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateNspNocReport = async (taskId: string, reportData: Partial<NspNocReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspNocReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspNocReport: updatedReport as NspNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspNocReport: updatedReport as NspNocReportData });
    } catch (err) {
      setError('Failed to update NSP NOC report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedNocReport = async (taskId: string, reportData: Partial<EntryRestrictedNocReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedNocReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedNocReport: updatedReport as EntryRestrictedNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedNocReport: updatedReport as EntryRestrictedNocReportData });
    } catch (err) {
      setError('Failed to update ERT NOC report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateUntraceableNocReport = async (taskId: string, reportData: Partial<UntraceableNocReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableNocReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableNocReport: updatedReport as UntraceableNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableNocReport: updatedReport as UntraceableNocReportData });
    } catch (err) {
      setError('Failed to update untraceable NOC report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updatePositiveDsaReport = async (taskId: string, reportData: Partial<PositiveDsaReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveDsaReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, positiveDsaReport: updatedReport as PositiveDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { positiveDsaReport: updatedReport as PositiveDsaReportData });
    } catch (err) {
      setError('Failed to update positive DSA report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateShiftedDsaReport = async (taskId: string, reportData: Partial<ShiftedDsaReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedDsaReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, shiftedDsaReport: updatedReport as ShiftedDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { shiftedDsaReport: updatedReport as ShiftedDsaReportData });
    } catch (err) {
      setError('Failed to update shifted DSA report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateNspDsaReport = async (taskId: string, reportData: Partial<NspDsaReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspDsaReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspDsaReport: updatedReport as NspDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspDsaReport: updatedReport as NspDsaReportData });
    } catch (err) {
      setError('Failed to update NSP DSA report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedDsaReport = async (taskId: string, reportData: Partial<EntryRestrictedDsaReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedDsaReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedDsaReport: updatedReport as EntryRestrictedDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedDsaReport: updatedReport as EntryRestrictedDsaReportData });
    } catch (err) {
      setError('Failed to update ERT DSA report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updateUntraceableDsaReport = async (taskId: string, reportData: Partial<UntraceableDsaReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableDsaReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceableDsaReport: updatedReport as UntraceableDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceableDsaReport: updatedReport as UntraceableDsaReportData });
    } catch (err) {
      setError('Failed to update untraceable DSA report.');
      console.error(err);
      fetchTasks();
    }
  };
  
  const updatePositivePropertyApfReport = async (taskId: string, reportData: Partial<PositivePropertyApfReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positivePropertyApfReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, positivePropertyApfReport: updatedReport as PositivePropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { positivePropertyApfReport: updatedReport as PositivePropertyApfReportData });
    } catch (err) {
      setError('Failed to update positive property APF report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateNspPropertyApfReport = async (taskId: string, reportData: Partial<NspPropertyApfReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspPropertyApfReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspPropertyApfReport: updatedReport as NspPropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspPropertyApfReport: updatedReport as NspPropertyApfReportData });
    } catch (err) {
      setError('Failed to update NSP property APF report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedPropertyApfReport = async (taskId: string, reportData: Partial<EntryRestrictedPropertyApfReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedPropertyApfReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedPropertyApfReport: updatedReport as EntryRestrictedPropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedPropertyApfReport: updatedReport as EntryRestrictedPropertyApfReportData });
    } catch (err) {
      setError('Failed to update ERT property APF report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateUntraceablePropertyApfReport = async (taskId: string, reportData: Partial<UntraceablePropertyApfReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceablePropertyApfReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceablePropertyApfReport: updatedReport as UntraceablePropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceablePropertyApfReport: updatedReport as UntraceablePropertyApfReportData });
    } catch (err) {
      setError('Failed to update untraceable property APF report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updatePositivePropertyIndividualReport = async (taskId: string, reportData: Partial<PositivePropertyIndividualReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positivePropertyIndividualReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, positivePropertyIndividualReport: updatedReport as PositivePropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { positivePropertyIndividualReport: updatedReport as PositivePropertyIndividualReportData });
    } catch (err) {
      setError('Failed to update positive property individual report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateNspPropertyIndividualReport = async (taskId: string, reportData: Partial<NspPropertyIndividualReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspPropertyIndividualReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, nspPropertyIndividualReport: updatedReport as NspPropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { nspPropertyIndividualReport: updatedReport as NspPropertyIndividualReportData });
    } catch (err) {
      setError('Failed to update NSP property individual report.');
      console.error(err);
      fetchTasks();
    }
  };

  const updateEntryRestrictedPropertyIndividualReport = async (taskId: string, reportData: Partial<EntryRestrictedPropertyIndividualReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedPropertyIndividualReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, entryRestrictedPropertyIndividualReport: updatedReport as EntryRestrictedPropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { entryRestrictedPropertyIndividualReport: updatedReport as EntryRestrictedPropertyIndividualReportData });
    } catch (err) {
      setError('Failed to update ERT property individual report.');
      console.error(err);
      fetchTasks();
    }
  };
  const updateUntraceablePropertyIndividualReport = async (taskId: string, reportData: Partial<UntraceablePropertyIndividualReportData>) => {
    try {
      const caseToUpdate = tasks.find(c => c.id === taskId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceablePropertyIndividualReport || {}), ...reportData };
      
      // Optimistic update
      setTasks(prevCases => prevCases.map(c => 
        c.id === taskId 
          ? { ...c, untraceablePropertyIndividualReport: updatedReport as UntraceablePropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));

      await taskService.updateTask(taskId, { untraceablePropertyIndividualReport: updatedReport as UntraceablePropertyIndividualReportData });
    } catch (err) {
      setError('Failed to update untraceable property individual report.');
      console.error(err);
      fetchTasks();
    }
  };

  const toggleSaveTask = async (taskId: string, isSaved: boolean) => {
    try {
      // Optimistic update
      const savedAt = isSaved ? new Date().toISOString() : undefined;
      
      setTasks(prevTasks => prevTasks.map(task => 
        task.id === taskId 
          ? { ...task, isSaved, savedAt, updatedAt: new Date().toISOString() } 
          : task
      ));

      const updates: Partial<VerificationTask> = { isSaved };
      if (isSaved) {
        updates.savedAt = savedAt;
      }
      
      await taskService.updateTask(taskId, updates);
      
      // No need to fetchTasks() as we've already updated local state
    } catch (err) {
      setError('Failed to update save status.');
      console.error(err);
      // Revert on error
      fetchTasks();
    }
  };
  
  const revokeTask = async (taskId: string, reason: RevokeReason) => {
    try {
      const currentUser = user; // Get current user from AuthContext
      
      // Optimistic update: Mark task as revoked immediately
      setTasks(prevTasks => prevTasks.map(task =>
        task.id === taskId
          ? {
              ...task,
              isRevoked: true,
              revokedAt: new Date().toISOString(),
              revokedBy: currentUser?.id || 'unknown',
              revokedByName: currentUser?.name || 'Unknown User',
              revokeReason: reason,
              updatedAt: new Date().toISOString()
            }
          : task
      ));

      // Background: Sync to backend
      await taskService.revokeTask(taskId, reason);
      
      console.log(`✅ Task ${taskId} revoked successfully with reason: ${reason}`);
    } catch (err) {
      setError('Failed to revoke task.');
      console.error(err);
      // Revert on error by refetching
      fetchTasks();
    }
  };

  const reorderInProgressTask = async (taskId: string, direction: 'up' | 'down') => {
    try {
        const inProgressTasks = tasks
            .filter(c => (c.taskStatus || c.status) === TaskStatus.InProgress)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIndex = inProgressTasks.findIndex(c => c.id === taskId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= inProgressTasks.length) return;

        const taskA = inProgressTasks[currentIndex];
        const taskB = inProgressTasks[newIndex];

        // Swap order
        const orderA = taskA.order;
        const orderB = taskB.order;

        await Promise.all([
            taskService.updateTask(taskA.id, { order: orderB }),
            taskService.updateTask(taskB.id, { order: orderA }),
        ]);

        fetchTasks();

    } catch (err) {
        setError('Failed to reorder tasks.');
        console.error(err);
    }
  };

  const syncTasks = async () => {
    setSyncing(true);
    setError(null);
    try {
      const serverData = await taskService.syncWithServer();

      // Preserve local status changes that haven't been synced to server
      const mergedTasks = serverData.map(serverTask => {
        const localTask = tasks.find(c => c.id === serverTask.id);

        // If we have a local task with a different status, preserve the local status
        // unless the server task has been updated more recently
        if (localTask && (localTask.status !== serverTask.status || localTask.taskStatus !== serverTask.taskStatus)) {
          const localUpdatedAt = new Date(localTask.updatedAt || localTask.createdAt);
          const serverUpdatedAt = new Date(serverTask.updatedAt || serverTask.createdAt);

          // If local task was updated more recently, preserve local status
          if (localUpdatedAt > serverUpdatedAt) {
            return {
              ...serverTask,
              status: localTask.status,
              taskStatus: localTask.taskStatus,
              updatedAt: localTask.updatedAt,
              inProgressAt: localTask.inProgressAt,
              completedAt: localTask.completedAt,
              submissionStatus: localTask.submissionStatus,
              isSaved: localTask.isSaved
            };
          }
        }

        return serverTask;
      });

      // Add any local tasks that don't exist on server (shouldn't happen, but safety check)
      const serverTaskIds = new Set(serverData.map(c => c.id));
      const localOnlyTasks = tasks.filter(c => !serverTaskIds.has(c.id));

      const finalTasks = [...mergedTasks, ...localOnlyTasks];
      setTasks(finalTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (err) {
      setError('Failed to sync tasks.');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  // Note: submitCase and resubmitCase methods have been removed
  // Task submission should now be handled through VerificationFormService
  // in the individual form components

  // Priority management functions
  const setTaskPriority = (taskId: string, priority: number | null) => {
    if (priority === null || priority === undefined) {
      priorityService.removePriority(taskId);
    } else {
      priorityService.setPriority(taskId, priority);
    }
  };

  const getTaskPriority = (taskId: string): number | null => {
    return priorityService.getPriority(taskId);
  };

  const getTasksWithPriorities = (): VerificationTask[] => {
    const priorities = priorityService.getAllPriorities();
    return tasks.map(taskItem => ({
      ...taskItem,
      priority: priorities[taskItem.id] || undefined
    }));
  };

  // Clean up priorities for non-existent tasks on load
  useEffect(() => {
    if (tasks.length > 0) {
      const taskIds = tasks.map(c => c.id);
      priorityService.cleanupPriorities(taskIds);
    }
  }, [tasks]);

  /**
   * Update task submission status (pending/submitting/success/failed)
   * This is used to track the status of form submissions to the backend
   */
  const updateTaskSubmissionStatus = async (
    taskId: string,
    status: 'pending' | 'submitting' | 'success' | 'failed',
    error?: string
  ) => {
    try {
      console.log(`📊 Updating submission status for task ${taskId}: ${status}`);

      // Prepare updates
      const updates: any = {
        submissionStatus: status,
        submissionError: error,
        lastSubmissionAttempt: new Date().toISOString()
      };

      // If submission is successful, clear the isSaved flag
      // This ensures the task doesn't appear in the "Saved" tab anymore
      if (status === 'success') {
        updates.isSaved = false;
        console.log(`🔓 Clearing isSaved flag for successfully submitted task ${taskId}`);
      }

      // Update local state immediately for responsive UI
      setTasks(prevTasks => prevTasks.map(c =>
        c.id === taskId
          ? { ...c, ...updates }
          : c
      ));

      // Persist to local storage (taskService handles this)
      await taskService.updateTask(taskId, updates);

      console.log(`✅ Submission status updated successfully for task ${taskId}`);
    } catch (err) {
      console.error(`❌ Failed to update submission status for task ${taskId}:`, err);
      setError('Failed to update submission status.');
    }
  };

  /**
   * Verify if a task was successfully submitted to the backend
   * Checks the verification task status on the server
   */
  const verifyTaskSubmissionStatus = async (taskId: string): Promise<{
    submitted: boolean;
    taskStatus?: string;
    error?: string;
  }> => {
    try {
      console.log(`🔍 Verifying submission status for task ${taskId}...`);

      // Find the task to get verification task ID
      const taskData = tasks.find(c => c.id === taskId);
      if (!taskData) {
        return {
          submitted: false,
          error: 'Task not found'
        };
      }

      if (!taskData.verificationTaskId) {
        return {
          submitted: false,
          error: 'No verification task ID found for this task'
        };
      }

      // Call backend to check task status
      const authToken = await AuthStorageService.getCurrentAccessToken();
      const apiBaseUrl = import.meta.env.PROD
        ? 'https://example.com/api'
        : (import.meta.env.VITE_API_BASE_URL_STATIC_IP || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api');

      const response = await fetch(`${apiBaseUrl}/mobile/verification-tasks/${taskData.verificationTaskId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'X-App-Version': '4.0.1',
          'X-Platform': 'WEB',
          'X-Client-Type': 'mobile',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const taskStatus = result.data.status;
        const isSubmitted = taskStatus === 'COMPLETED';

        console.log(`✅ Verification status check: Task ${taskData.verificationTaskId} is ${taskStatus}`);

        // Update local submission status based on server status
        if (isSubmitted && taskData.submissionStatus !== 'success') {
          await updateTaskSubmissionStatus(taskId, 'success');
        }

        return {
          submitted: isSubmitted,
          taskStatus: taskStatus
        };
      } else {
        return {
          submitted: false,
          error: result.message || 'Failed to verify submission status'
        };
      }
    } catch (err) {
      console.error(`❌ Error verifying submission status for task ${taskId}:`, err);
      return {
        submitted: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  };

  return (
    <TaskContext.Provider value={{
      tasks,
      loading,
      syncing,
      error,
    fetchTasks,
    updateTaskStatus,
    updateVerificationOutcome,
    updateResidenceReport,
    updateShiftedResidenceReport,
    updateNspResidenceReport,
    updateEntryRestrictedResidenceReport,
    updateUntraceableResidenceReport,
    updateResiCumOfficeReport,
    updateShiftedResiCumOfficeReport,
    updateNspResiCumOfficeReport,
    updateEntryRestrictedResiCumOfficeReport,
    updateUntraceableResiCumOfficeReport,
    updatePositiveOfficeReport,
    updateShiftedOfficeReport,
    updateNspOfficeReport,
    updateEntryRestrictedOfficeReport,
    updateUntraceableOfficeReport,
    updatePositiveBusinessReport,
    updateShiftedBusinessReport,
    updateNspBusinessReport,
    updateEntryRestrictedBusinessReport,
    updateUntraceableBusinessReport,
    updatePositiveBuilderReport,
    updateShiftedBuilderReport,
    updateNspBuilderReport,
    updateEntryRestrictedBuilderReport,
    updateUntraceableBuilderReport,
    updatePositiveNocReport,
    updateShiftedNocReport,
    updateNspNocReport,
    updateEntryRestrictedNocReport,
    updateUntraceableNocReport,
    updatePositiveDsaReport,
    updateShiftedDsaReport,
    updateNspDsaReport,
    updateEntryRestrictedDsaReport,
    updateUntraceableDsaReport,
    updatePositivePropertyApfReport,
    updateNspPropertyApfReport,
    updateEntryRestrictedPropertyApfReport,
    updateUntraceablePropertyApfReport,
    updatePositivePropertyIndividualReport,
    updateNspPropertyIndividualReport,
    updateEntryRestrictedPropertyIndividualReport,
    updateUntraceablePropertyIndividualReport,
    toggleSaveTask,
    revokeTask,
    reorderInProgressTask,
    syncTasks,
    setTaskPriority,
    getTaskPriority,
    getTasksWithPriorities,
    updateTaskSubmissionStatus,
    verifyTaskSubmissionStatus,
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a CaseProvider');
  }
  return context;
};