import { useState, useEffect } from 'react';
import { autoSaveService } from '../services/autoSaveService';
import { getAllFormTypes } from '../constants/formTypes';

/**
 * Hook to check if a case has auto-saved draft data
 */
export const useCaseAutoSaveStatus = (caseId: string) => {
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAutoSaveData = async () => {
      try {
        setIsLoading(true);

        // Check for auto-saved data across all verification form types for this case
        const formTypes = getAllFormTypes();

        let hasData = false;
        for (const formType of formTypes) {
          const hasSaved = await autoSaveService.hasAutoSaveData(caseId, formType);
          if (hasSaved) {
            hasData = true;
            break;
          }
        }

        setHasAutoSaveData(hasData);

      } catch (error) {
        console.error('Error checking auto-save status:', error);
        setHasAutoSaveData(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAutoSaveData();
  }, [caseId]);

  return { hasAutoSaveData, isLoading };
};
