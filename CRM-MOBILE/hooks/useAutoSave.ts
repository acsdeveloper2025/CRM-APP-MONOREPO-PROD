import { useEffect, useRef, useState, useCallback } from 'react';
import { autoSaveService, AutoSaveData } from '../services/autoSaveService';
import { CapturedImage } from '../types';

export interface AutoSaveStatus {
  isAutoSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  autoSaveError: string | null;
  hasSavedData: boolean;
}

export interface UseAutoSaveOptions {
  debounceMs?: number;
  enableAutoSave?: boolean;
  onAutoSaveSuccess?: (data: AutoSaveData) => void;
  onAutoSaveError?: (error: Error) => void;
  onDataRestored?: (data: AutoSaveData) => void;
}

export interface UseAutoSaveReturn {
  autoSaveStatus: AutoSaveStatus;
  saveFormData: (formData: any, images?: CapturedImage[]) => Promise<void>;
  restoreFormData: () => Promise<AutoSaveData | null>;
  clearAutoSaveData: () => Promise<void>;
  markFormCompleted: () => Promise<void>;
  forceSave: () => Promise<void>;
}

/**
 * Custom hook for auto-save functionality
 */
export const useAutoSave = (
  caseId: string,
  formType: string,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn => {
  const {
    debounceMs = 1000,
    enableAutoSave = true,
    onAutoSaveSuccess,
    onAutoSaveError,
    onDataRestored
  } = options;

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>({
    isAutoSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    autoSaveError: null,
    hasSavedData: false
  });

  const lastFormDataRef = useRef<string>('');
  const isInitializedRef = useRef(false);

  /**
   * Update auto-save status
   */
  const updateStatus = useCallback((updates: Partial<AutoSaveStatus>) => {
    setAutoSaveStatus(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Save form data with auto-save
   */
  const saveFormData = useCallback(async (
    formData: any,
    images: CapturedImage[] = []
  ): Promise<void> => {
    if (!enableAutoSave) return;

    try {
      updateStatus({ isAutoSaving: true, autoSaveError: null });

      // Check if data has actually changed
      const currentDataString = JSON.stringify({ formData, images });
      if (currentDataString === lastFormDataRef.current) {
        updateStatus({ isAutoSaving: false });
        return;
      }

      lastFormDataRef.current = currentDataString;

      await autoSaveService.saveFormData(
        caseId,
        formType,
        formData,
        images,
        { debounceMs }
      );

      const now = new Date();
      updateStatus({
        isAutoSaving: false,
        lastSaved: now,
        hasUnsavedChanges: false,
        hasSavedData: true
      });

      // Call success callback
      if (onAutoSaveSuccess) {
        const savedData = await autoSaveService.getFormData(caseId, formType);
        if (savedData) {
          onAutoSaveSuccess(savedData);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-save failed';
      updateStatus({
        isAutoSaving: false,
        autoSaveError: errorMessage,
        hasUnsavedChanges: true
      });

      if (onAutoSaveError) {
        onAutoSaveError(error instanceof Error ? error : new Error(errorMessage));
      }

      console.error('Auto-save error:', error);
    }
  }, [caseId, formType, enableAutoSave, debounceMs, onAutoSaveSuccess, onAutoSaveError, updateStatus]);

  /**
   * Restore form data from auto-save
   */
  const restoreFormData = useCallback(async (): Promise<AutoSaveData | null> => {
    try {
      const savedData = await autoSaveService.getFormData(caseId, formType);
      
      if (savedData) {
        updateStatus({ 
          hasSavedData: true,
          lastSaved: new Date(savedData.lastSaved)
        });

        if (onDataRestored) {
          onDataRestored(savedData);
        }
      }

      return savedData;
    } catch (error) {
      console.error('Error restoring form data:', error);
      updateStatus({ autoSaveError: 'Failed to restore saved data' });
      return null;
    }
  }, [caseId, formType, onDataRestored, updateStatus]);

  /**
   * Clear auto-save data
   */
  const clearAutoSaveData = useCallback(async (): Promise<void> => {
    try {
      await autoSaveService.removeAutoSaveData(caseId, formType);
      updateStatus({
        hasSavedData: false,
        lastSaved: null,
        hasUnsavedChanges: false,
        autoSaveError: null
      });
      lastFormDataRef.current = '';
    } catch (error) {
      console.error('Error clearing auto-save data:', error);
      updateStatus({ autoSaveError: 'Failed to clear saved data' });
    }
  }, [caseId, formType, updateStatus]);

  /**
   * Mark form as completed
   */
  const markFormCompleted = useCallback(async (): Promise<void> => {
    try {
      await autoSaveService.markFormCompleted(caseId, formType);
      updateStatus({
        hasUnsavedChanges: false,
        autoSaveError: null
      });
    } catch (error) {
      console.error('Error marking form as completed:', error);
      updateStatus({ autoSaveError: 'Failed to mark form as completed' });
    }
  }, [caseId, formType, updateStatus]);

  /**
   * Immediately clean up completed form (for use after successful submission)
   */
  const cleanupCompletedForm = useCallback(async (): Promise<void> => {
    try {
      await autoSaveService.cleanupCompletedForm(caseId, formType);
      updateStatus({
        hasUnsavedChanges: false,
        hasSavedData: false,
        lastSaved: null,
        autoSaveError: null
      });
    } catch (error) {
      console.error('Error cleaning up completed form:', error);
      updateStatus({ autoSaveError: 'Failed to cleanup completed form' });
    }
  }, [caseId, formType, updateStatus]);

  /**
   * Force save immediately
   */
  const forceSave = useCallback(async (): Promise<void> => {
    try {
      await autoSaveService.forceSaveAll();
      updateStatus({ hasUnsavedChanges: false });
    } catch (error) {
      console.error('Error force saving:', error);
      updateStatus({ autoSaveError: 'Failed to force save' });
    }
  }, [updateStatus]);

  /**
   * Check for existing saved data on mount
   */
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      
      const checkForSavedData = async () => {
        try {
          const hasSaved = await autoSaveService.hasAutoSaveData(caseId, formType);
          updateStatus({ hasSavedData: hasSaved });
        } catch (error) {
          console.error('Error checking for saved data:', error);
        }
      };

      checkForSavedData();
    }
  }, [caseId, formType, updateStatus]);

  /**
   * Set up auto-save listener
   */
  useEffect(() => {
    const key = `autosave_${caseId}_${formType}`;
    
    const handleAutoSaveUpdate = (data: AutoSaveData | null) => {
      if (data) {
        updateStatus({
          lastSaved: new Date(data.lastSaved),
          hasSavedData: true
        });
      } else {
        updateStatus({
          hasSavedData: false,
          lastSaved: null
        });
      }
    };

    autoSaveService.addListener(key, handleAutoSaveUpdate);

    return () => {
      autoSaveService.removeListener(key, handleAutoSaveUpdate);
    };
  }, [caseId, formType, updateStatus]);

  /**
   * Handle page visibility changes
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && autoSaveStatus.hasUnsavedChanges) {
        // Force save when page becomes hidden
        forceSave();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoSaveStatus.hasUnsavedChanges, forceSave]);

  /**
   * Handle beforeunload event
   */
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (autoSaveStatus.hasUnsavedChanges) {
        // Force save before unload
        forceSave();
        
        // Show warning to user
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autoSaveStatus.hasUnsavedChanges, forceSave]);

  return {
    autoSaveStatus,
    saveFormData,
    restoreFormData,
    clearAutoSaveData,
    markFormCompleted,
    forceSave
  };
};
