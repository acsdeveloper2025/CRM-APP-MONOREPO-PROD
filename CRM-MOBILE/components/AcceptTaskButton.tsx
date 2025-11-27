import React, { useState } from 'react';
import { VerificationTask, TaskStatus } from '../types';
import { CheckIcon } from './Icons';
import TaskStatusService from "./services/taskStatusService"
import AuditService from '../services/auditService';

/**
 * Enhanced Accept Case Button Component
 * Handles case acceptance with optimistic UI, offline support, and loading states
 */

interface AcceptTaskButtonProps {
  taskData: VerificationTask;
  onStatusUpdate: (taskId: string, newStatus: VerificationTaskStatus) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

const AcceptTaskButton: React.FC<AcceptCaseButtonProps> = ({
  taskData,
  onStatusUpdate,
  onError,
  onSuccess,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAcceptTask = async () => {
    if (isAccepting || (taskData.taskStatus || taskData.status) !== TaskStatus.Assigned) {
      return;
    }

    setIsAccepting(true);

    try {
      console.log(`🎯 Accepting case ${taskData.id}...`);

      // Prepare audit metadata
      const auditMetadata = {
        customerName: taskData.customer.name,
        verificationType: taskData.verificationType,
        caseTitle: taskData.title,
        address: taskData.address || taskData.visitAddress,
        acceptedAt: new Date().toISOString(),
      };

      // Update case status
      const result = await TaskStatusService.updateCaseStatus(
        taskData.id,
        TaskStatus.InProgress
      );

      if (result.success) {
        // Log the status change for audit purposes
        await AuditService.logCaseStatusChange(
          taskData.id,
          TaskStatus.Assigned,
          TaskStatus.InProgress,
          {
            customerName: taskData.customer.name,
            verificationType: taskData.verificationType,
            metadata: auditMetadata,
          }
        );

        // Update parent component
        onStatusUpdate(taskData.id, TaskStatus.InProgress);

        // Show success feedback
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);

        // Show success message
        const successMessage = 'Case accepted successfully!';
        onSuccess?.(successMessage);

        console.log(`✅ Case ${taskData.id} accepted successfully`);
      } else {
        const errorMessage = result.error || 'Failed to accept case';
        console.error(`❌ Failed to accept case ${taskData.id}:`, errorMessage);
        onError?.(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ Error accepting case ${taskData.id}:`, error);
      onError?.(errorMessage);
    } finally {
      setIsAccepting(false);
    }
  };

  // Don't render if case is not assigned
  if ((taskData.taskStatus || taskData.status) !== TaskStatus.Assigned) {
    return null;
  }

  return (
    <button
      onClick={handleAcceptTask}
      disabled={isAccepting}
      className={`
        flex flex-col items-center transition-all duration-200
        ${isAccepting 
          ? 'text-gray-400 cursor-not-allowed' 
          : showSuccess
          ? 'text-green-300 scale-110'
          : 'text-green-400 hover:text-green-300 hover:scale-105 active:scale-95'
        }
      `}
      aria-label={isAccepting ? 'Accepting case...' : 'Accept case'}
    >
      <div className="relative">
        {isAccepting ? (
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : showSuccess ? (
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          </div>
        ) : (
          <CheckIcon />
        )}

      </div>
      
      <span className={`text-xs mt-1 transition-all duration-200 ${
        isAccepting 
          ? 'text-gray-400' 
          : showSuccess
          ? 'text-green-300 font-semibold'
          : 'text-current'
      }`}>
        {isAccepting ? 'Accepting...' : showSuccess ? 'Accepted!' : 'Accept'}
      </span>

    </button>
  );
};

export default AcceptTaskButton;
