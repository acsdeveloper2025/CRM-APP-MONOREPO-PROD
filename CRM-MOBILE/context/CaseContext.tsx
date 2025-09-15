import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Case, CaseStatus, VerificationOutcome, ResidenceReportData, ShiftedResidenceReportData, NspResidenceReportData, EntryRestrictedResidenceReportData, UntraceableResidenceReportData, ResiCumOfficeReportData, ShiftedResiCumOfficeReportData, NspResiCumOfficeReportData, EntryRestrictedResiCumOfficeReportData, UntraceableResiCumOfficeReportData, PositiveOfficeReportData, ShiftedOfficeReportData, NspOfficeReportData, EntryRestrictedOfficeReportData, UntraceableOfficeReportData, PositiveBusinessReportData, ShiftedBusinessReportData, NspBusinessReportData, EntryRestrictedBusinessReportData, UntraceableBusinessReportData, PositiveBuilderReportData, ShiftedBuilderReportData, NspBuilderReportData, EntryRestrictedBuilderReportData, UntraceableBuilderReportData, PositiveNocReportData, ShiftedNocReportData, NspNocReportData, EntryRestrictedNocReportData, UntraceableNocReportData, PositiveDsaReportData, ShiftedDsaReportData, NspDsaReportData, EntryRestrictedDsaReportData, UntraceableDsaReportData, PositivePropertyApfReportData, NspPropertyApfReportData, EntryRestrictedPropertyApfReportData, UntraceablePropertyApfReportData, PositivePropertyIndividualReportData, NspPropertyIndividualReportData, EntryRestrictedPropertyIndividualReportData, UntraceablePropertyIndividualReportData, RevokeReason } from '../types';
import { caseService } from '../services/caseService';
import { priorityService } from '../services/priorityService';
import CaseStatusService from '../services/caseStatusService';
import AuditService from '../services/auditService';
import NetworkService from '../services/networkService';
import CaseCounterService from '../services/caseCounterService';
import { useAuth } from './AuthContext';
import { getReportInfo } from '../data/initialReportData';

interface CaseContextType {
  cases: Case[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  fetchCases: () => void;
  updateCaseStatus: (caseId: string, status: CaseStatus) => Promise<void>;
  updateVerificationOutcome: (caseId: string, outcome: VerificationOutcome | null) => Promise<void>;
  updateResidenceReport: (caseId: string, reportData: Partial<ResidenceReportData>) => Promise<void>;
  updateShiftedResidenceReport: (caseId: string, reportData: Partial<ShiftedResidenceReportData>) => Promise<void>;
  updateNspResidenceReport: (caseId: string, reportData: Partial<NspResidenceReportData>) => Promise<void>;
  updateEntryRestrictedResidenceReport: (caseId: string, reportData: Partial<EntryRestrictedResidenceReportData>) => Promise<void>;
  updateUntraceableResidenceReport: (caseId: string, reportData: Partial<UntraceableResidenceReportData>) => Promise<void>;
  updateResiCumOfficeReport: (caseId: string, reportData: Partial<ResiCumOfficeReportData>) => Promise<void>;
  updateShiftedResiCumOfficeReport: (caseId: string, reportData: Partial<ShiftedResiCumOfficeReportData>) => Promise<void>;
  updateNspResiCumOfficeReport: (caseId: string, reportData: Partial<NspResiCumOfficeReportData>) => Promise<void>;
  updateEntryRestrictedResiCumOfficeReport: (caseId: string, reportData: Partial<EntryRestrictedResiCumOfficeReportData>) => Promise<void>;
  updateUntraceableResiCumOfficeReport: (caseId: string, reportData: Partial<UntraceableResiCumOfficeReportData>) => Promise<void>;
  updatePositiveOfficeReport: (caseId: string, reportData: Partial<PositiveOfficeReportData>) => Promise<void>;
  updateShiftedOfficeReport: (caseId: string, reportData: Partial<ShiftedOfficeReportData>) => Promise<void>;
  updateNspOfficeReport: (caseId: string, reportData: Partial<NspOfficeReportData>) => Promise<void>;
  updateEntryRestrictedOfficeReport: (caseId: string, reportData: Partial<EntryRestrictedOfficeReportData>) => Promise<void>;
  updateUntraceableOfficeReport: (caseId: string, reportData: Partial<UntraceableOfficeReportData>) => Promise<void>;
  updatePositiveBusinessReport: (caseId: string, reportData: Partial<PositiveBusinessReportData>) => Promise<void>;
  updateShiftedBusinessReport: (caseId: string, reportData: Partial<ShiftedBusinessReportData>) => Promise<void>;
  updateNspBusinessReport: (caseId: string, reportData: Partial<NspBusinessReportData>) => Promise<void>;
  updateEntryRestrictedBusinessReport: (caseId: string, reportData: Partial<EntryRestrictedBusinessReportData>) => Promise<void>;
  updateUntraceableBusinessReport: (caseId: string, reportData: Partial<UntraceableBusinessReportData>) => Promise<void>;
  updatePositiveBuilderReport: (caseId: string, reportData: Partial<PositiveBuilderReportData>) => Promise<void>;
  updateShiftedBuilderReport: (caseId: string, reportData: Partial<ShiftedBuilderReportData>) => Promise<void>;
  updateNspBuilderReport: (caseId: string, reportData: Partial<NspBuilderReportData>) => Promise<void>;
  updateEntryRestrictedBuilderReport: (caseId: string, reportData: Partial<EntryRestrictedBuilderReportData>) => Promise<void>;
  updateUntraceableBuilderReport: (caseId: string, reportData: Partial<UntraceableBuilderReportData>) => Promise<void>;
  updatePositiveNocReport: (caseId: string, reportData: Partial<PositiveNocReportData>) => Promise<void>;
  updateShiftedNocReport: (caseId: string, reportData: Partial<ShiftedNocReportData>) => Promise<void>;
  updateNspNocReport: (caseId: string, reportData: Partial<NspNocReportData>) => Promise<void>;
  updateEntryRestrictedNocReport: (caseId: string, reportData: Partial<EntryRestrictedNocReportData>) => Promise<void>;
  updateUntraceableNocReport: (caseId: string, reportData: Partial<UntraceableNocReportData>) => Promise<void>;
  updatePositiveDsaReport: (caseId: string, reportData: Partial<PositiveDsaReportData>) => Promise<void>;
  updateShiftedDsaReport: (caseId: string, reportData: Partial<ShiftedDsaReportData>) => Promise<void>;
  updateNspDsaReport: (caseId: string, reportData: Partial<NspDsaReportData>) => Promise<void>;
  updateEntryRestrictedDsaReport: (caseId: string, reportData: Partial<EntryRestrictedDsaReportData>) => Promise<void>;
  updateUntraceableDsaReport: (caseId: string, reportData: Partial<UntraceableDsaReportData>) => Promise<void>;
  updatePositivePropertyApfReport: (caseId: string, reportData: Partial<PositivePropertyApfReportData>) => Promise<void>;
  updateNspPropertyApfReport: (caseId: string, reportData: Partial<NspPropertyApfReportData>) => Promise<void>;
  updateEntryRestrictedPropertyApfReport: (caseId: string, reportData: Partial<EntryRestrictedPropertyApfReportData>) => Promise<void>;
  updateUntraceablePropertyApfReport: (caseId: string, reportData: Partial<UntraceablePropertyApfReportData>) => Promise<void>;
  updatePositivePropertyIndividualReport: (caseId: string, reportData: Partial<PositivePropertyIndividualReportData>) => Promise<void>;
  updateNspPropertyIndividualReport: (caseId: string, reportData: Partial<NspPropertyIndividualReportData>) => Promise<void>;
  updateEntryRestrictedPropertyIndividualReport: (caseId: string, reportData: Partial<EntryRestrictedPropertyIndividualReportData>) => Promise<void>;
  updateUntraceablePropertyIndividualReport: (caseId: string, reportData: Partial<UntraceablePropertyIndividualReportData>) => Promise<void>;
  toggleSaveCase: (caseId: string, isSaved: boolean) => Promise<void>;
  revokeCase: (caseId: string, reason: RevokeReason) => Promise<void>;
  reorderInProgressCase: (caseId: string, direction: 'up' | 'down') => Promise<void>;
  syncCases: () => Promise<void>;
  // Priority management functions
  setCasePriority: (caseId: string, priority: number | null) => void;
  getCasePriority: (caseId: string) => number | null;
  getCasesWithPriorities: () => Case[];
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await caseService.getCases();
      const sortedCases = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCases(sortedCases);

      // Update case counters
      await CaseCounterService.updateCounts(sortedCases);
    } catch (err) {
      setError('Failed to fetch cases.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCases();
    } else {
      setCases([]);
    }
  }, [isAuthenticated, fetchCases]);

  const updateCaseStatus = async (caseId: string, status: CaseStatus) => {
    try {
      const currentCase = cases.find(c => c.id === caseId);
      if (!currentCase) throw new Error("Case not found");

      // Prepare audit metadata
      const auditMetadata = {
        customerName: currentCase.customer.name,
        verificationType: currentCase.verificationType,
        caseTitle: currentCase.title,
        address: currentCase.address || currentCase.visitAddress,
        updatedAt: new Date().toISOString(),
        networkStatus: NetworkService.isOnline() ? 'online' : 'offline',
      };

      // Use enhanced case status service with optimistic UI and offline support
      const result = await CaseStatusService.updateCaseStatus(caseId, status, {
        optimistic: true,
        auditMetadata,
      });

      if (result.success) {
        // Log the status change for audit purposes
        await AuditService.logCaseStatusChange(
          caseId,
          currentCase.status,
          status,
          {
            customerName: currentCase.customer.name,
            verificationType: currentCase.verificationType,
            metadata: auditMetadata,
          }
        );

        // Record status change for counter tracking
        await CaseCounterService.recordStatusChange(caseId, currentCase.status, status);

        // Update local state immediately instead of refetching from API
        // This preserves the optimistic UI update
        const updatedCases = cases.map(c =>
          c.id === caseId
            ? { ...c, status, updatedAt: new Date().toISOString(),
                ...(status === CaseStatus.InProgress && !c.inProgressAt ? { inProgressAt: new Date().toISOString() } : {}),
                ...(status === CaseStatus.Completed ? { completedAt: new Date().toISOString(), submissionStatus: 'pending' as const, isSaved: false } : {})
              }
            : c
        );
        setCases(updatedCases);

        // Update case counters with the new state
        await CaseCounterService.updateCounts(updatedCases);

        // Update completed successfully
      } else {
        throw new Error(result.error || 'Failed to update case status');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update case status';
      setError(errorMessage);
      console.error(`❌ Error updating case ${caseId}:`, err);
    }
  };
  
  const updateVerificationOutcome = async (caseId: string, outcome: VerificationOutcome | null) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) {
        throw new Error("Case not found");
      }
  
      const updates: Partial<Case> = { verificationOutcome: outcome };
  
      if (outcome) {
        const reportInfo = getReportInfo(caseToUpdate.verificationType, outcome);
        
        // Check if the report key exists on the case object and is undefined/null
        if (reportInfo && !caseToUpdate[reportInfo.key as keyof Case]) {
          (updates as any)[reportInfo.key] = reportInfo.data;
        }
      }

      await caseService.updateCase(caseId, updates);

      // Update local state immediately instead of refetching from API
      // This preserves any local status changes (like In Progress status)
      const updatedCases = cases.map(c =>
        c.id === caseId
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      );
      setCases(updatedCases);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update verification outcome';
      setError(errorMessage);
      console.error(`❌ Error updating verification outcome for case ${caseId}:`, err);
    }
  };

  const updateResidenceReport = async (caseId: string, reportData: Partial<ResidenceReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.residenceReport || {}), ...reportData };
      await caseService.updateCase(caseId, { residenceReport: updatedReport as ResidenceReportData });
      setCases(prevCases => prevCases.map(c =>
        c.id === caseId
          ? { ...c, residenceReport: updatedReport as ResidenceReportData, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
          : c
      ));
    } catch (err) {
      setError('Failed to update residence report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateShiftedResidenceReport = async (caseId: string, reportData: Partial<ShiftedResidenceReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedResidenceReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedResidenceReport: updatedReport as ShiftedResidenceReportData });
      setCases(prevCases => prevCases.map(c =>
        c.id === caseId
          ? { ...c, shiftedResidenceReport: updatedReport as ShiftedResidenceReportData, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted residence report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateNspResidenceReport = async (caseId: string, reportData: Partial<NspResidenceReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspResidenceReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspResidenceReport: updatedReport as NspResidenceReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspResidenceReport: updatedReport as NspResidenceReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP residence report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedResidenceReport = async (caseId: string, reportData: Partial<EntryRestrictedResidenceReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedResidenceReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedResidenceReport: updatedReport as EntryRestrictedResidenceReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedResidenceReport: updatedReport as EntryRestrictedResidenceReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update entry restricted residence report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateUntraceableResidenceReport = async (caseId: string, reportData: Partial<UntraceableResidenceReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableResidenceReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableResidenceReport: updatedReport as UntraceableResidenceReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableResidenceReport: updatedReport as UntraceableResidenceReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable residence report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateResiCumOfficeReport = async (caseId: string, reportData: Partial<ResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.resiCumOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { resiCumOfficeReport: updatedReport as ResiCumOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, resiCumOfficeReport: updatedReport as ResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update resi-cum-office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateShiftedResiCumOfficeReport = async (caseId: string, reportData: Partial<ShiftedResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedResiCumOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedResiCumOfficeReport: updatedReport as ShiftedResiCumOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, shiftedResiCumOfficeReport: updatedReport as ShiftedResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted resi-cum-office report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateNspResiCumOfficeReport = async (caseId: string, reportData: Partial<NspResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspResiCumOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspResiCumOfficeReport: updatedReport as NspResiCumOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspResiCumOfficeReport: updatedReport as NspResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP resi-cum-office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedResiCumOfficeReport = async (caseId: string, reportData: Partial<EntryRestrictedResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedResiCumOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedResiCumOfficeReport: updatedReport as EntryRestrictedResiCumOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedResiCumOfficeReport: updatedReport as EntryRestrictedResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT resi-cum-office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceableResiCumOfficeReport = async (caseId: string, reportData: Partial<UntraceableResiCumOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableResiCumOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableResiCumOfficeReport: updatedReport as UntraceableResiCumOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableResiCumOfficeReport: updatedReport as UntraceableResiCumOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable resi-cum-office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updatePositiveOfficeReport = async (caseId: string, reportData: Partial<PositiveOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positiveOfficeReport: updatedReport as PositiveOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, positiveOfficeReport: updatedReport as PositiveOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update positive office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateShiftedOfficeReport = async (caseId: string, reportData: Partial<ShiftedOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedOfficeReport: updatedReport as ShiftedOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, shiftedOfficeReport: updatedReport as ShiftedOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted office report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateNspOfficeReport = async (caseId: string, reportData: Partial<NspOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspOfficeReport: updatedReport as NspOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspOfficeReport: updatedReport as NspOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP office report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateEntryRestrictedOfficeReport = async (caseId: string, reportData: Partial<EntryRestrictedOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedOfficeReport: updatedReport as EntryRestrictedOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedOfficeReport: updatedReport as EntryRestrictedOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceableOfficeReport = async (caseId: string, reportData: Partial<UntraceableOfficeReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableOfficeReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableOfficeReport: updatedReport as UntraceableOfficeReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableOfficeReport: updatedReport as UntraceableOfficeReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable office report.');
      console.error(err);
      fetchCases();
    }
  };

  const updatePositiveBusinessReport = async (caseId: string, reportData: Partial<PositiveBusinessReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveBusinessReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positiveBusinessReport: updatedReport as PositiveBusinessReportData });
      setCases(prevCases => prevCases.map(c =>
        c.id === caseId
          ? { ...c, positiveBusinessReport: updatedReport as PositiveBusinessReportData, updatedAt: new Date().toISOString(), savedAt: new Date().toISOString() }
          : c
      ));
    } catch (err) {
      setError('Failed to update positive business report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateShiftedBusinessReport = async (caseId: string, reportData: Partial<ShiftedBusinessReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedBusinessReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedBusinessReport: updatedReport as ShiftedBusinessReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, shiftedBusinessReport: updatedReport as ShiftedBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted business report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateNspBusinessReport = async (caseId: string, reportData: Partial<NspBusinessReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspBusinessReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspBusinessReport: updatedReport as NspBusinessReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspBusinessReport: updatedReport as NspBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP business report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedBusinessReport = async (caseId: string, reportData: Partial<EntryRestrictedBusinessReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedBusinessReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedBusinessReport: updatedReport as EntryRestrictedBusinessReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedBusinessReport: updatedReport as EntryRestrictedBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT business report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceableBusinessReport = async (caseId: string, reportData: Partial<UntraceableBusinessReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableBusinessReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableBusinessReport: updatedReport as UntraceableBusinessReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableBusinessReport: updatedReport as UntraceableBusinessReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable business report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updatePositiveBuilderReport = async (caseId: string, reportData: Partial<PositiveBuilderReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveBuilderReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positiveBuilderReport: updatedReport as PositiveBuilderReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, positiveBuilderReport: updatedReport as PositiveBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update positive builder report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateShiftedBuilderReport = async (caseId: string, reportData: Partial<ShiftedBuilderReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedBuilderReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedBuilderReport: updatedReport as ShiftedBuilderReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, shiftedBuilderReport: updatedReport as ShiftedBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted builder report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateNspBuilderReport = async (caseId: string, reportData: Partial<NspBuilderReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspBuilderReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspBuilderReport: updatedReport as NspBuilderReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspBuilderReport: updatedReport as NspBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP builder report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateEntryRestrictedBuilderReport = async (caseId: string, reportData: Partial<EntryRestrictedBuilderReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedBuilderReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedBuilderReport: updatedReport as EntryRestrictedBuilderReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedBuilderReport: updatedReport as EntryRestrictedBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT builder report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceableBuilderReport = async (caseId: string, reportData: Partial<UntraceableBuilderReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableBuilderReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableBuilderReport: updatedReport as UntraceableBuilderReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableBuilderReport: updatedReport as UntraceableBuilderReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable builder report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updatePositiveNocReport = async (caseId: string, reportData: Partial<PositiveNocReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveNocReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positiveNocReport: updatedReport as PositiveNocReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, positiveNocReport: updatedReport as PositiveNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update positive NOC report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateShiftedNocReport = async (caseId: string, reportData: Partial<ShiftedNocReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedNocReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedNocReport: updatedReport as ShiftedNocReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, shiftedNocReport: updatedReport as ShiftedNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted NOC report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateNspNocReport = async (caseId: string, reportData: Partial<NspNocReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspNocReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspNocReport: updatedReport as NspNocReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspNocReport: updatedReport as NspNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP NOC report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedNocReport = async (caseId: string, reportData: Partial<EntryRestrictedNocReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedNocReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedNocReport: updatedReport as EntryRestrictedNocReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedNocReport: updatedReport as EntryRestrictedNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT NOC report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceableNocReport = async (caseId: string, reportData: Partial<UntraceableNocReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableNocReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableNocReport: updatedReport as UntraceableNocReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableNocReport: updatedReport as UntraceableNocReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable NOC report.');
      console.error(err);
      fetchCases();
    }
  };

  const updatePositiveDsaReport = async (caseId: string, reportData: Partial<PositiveDsaReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positiveDsaReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positiveDsaReport: updatedReport as PositiveDsaReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, positiveDsaReport: updatedReport as PositiveDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update positive DSA/DST report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateShiftedDsaReport = async (caseId: string, reportData: Partial<ShiftedDsaReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.shiftedDsaReport || {}), ...reportData };
      await caseService.updateCase(caseId, { shiftedDsaReport: updatedReport as ShiftedDsaReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, shiftedDsaReport: updatedReport as ShiftedDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update shifted DSA/DST report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateNspDsaReport = async (caseId: string, reportData: Partial<NspDsaReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspDsaReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspDsaReport: updatedReport as NspDsaReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspDsaReport: updatedReport as NspDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP DSA/DST report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedDsaReport = async (caseId: string, reportData: Partial<EntryRestrictedDsaReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedDsaReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedDsaReport: updatedReport as EntryRestrictedDsaReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedDsaReport: updatedReport as EntryRestrictedDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT DSA/DST report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updateUntraceableDsaReport = async (caseId: string, reportData: Partial<UntraceableDsaReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceableDsaReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceableDsaReport: updatedReport as UntraceableDsaReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceableDsaReport: updatedReport as UntraceableDsaReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable DSA/DST report.');
      console.error(err);
      fetchCases();
    }
  };
  
  const updatePositivePropertyApfReport = async (caseId: string, reportData: Partial<PositivePropertyApfReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positivePropertyApfReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positivePropertyApfReport: updatedReport as PositivePropertyApfReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, positivePropertyApfReport: updatedReport as PositivePropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update positive Property APF report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateNspPropertyApfReport = async (caseId: string, reportData: Partial<NspPropertyApfReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspPropertyApfReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspPropertyApfReport: updatedReport as NspPropertyApfReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspPropertyApfReport: updatedReport as NspPropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP Property APF report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedPropertyApfReport = async (caseId: string, reportData: Partial<EntryRestrictedPropertyApfReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedPropertyApfReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedPropertyApfReport: updatedReport as EntryRestrictedPropertyApfReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedPropertyApfReport: updatedReport as EntryRestrictedPropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT Property APF report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceablePropertyApfReport = async (caseId: string, reportData: Partial<UntraceablePropertyApfReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceablePropertyApfReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceablePropertyApfReport: updatedReport as UntraceablePropertyApfReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceablePropertyApfReport: updatedReport as UntraceablePropertyApfReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update untraceable Property APF report.');
      console.error(err);
      fetchCases();
    }
  };

  const updatePositivePropertyIndividualReport = async (caseId: string, reportData: Partial<PositivePropertyIndividualReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.positivePropertyIndividualReport || {}), ...reportData };
      await caseService.updateCase(caseId, { positivePropertyIndividualReport: updatedReport as PositivePropertyIndividualReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, positivePropertyIndividualReport: updatedReport as PositivePropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update positive Property Individual report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateNspPropertyIndividualReport = async (caseId: string, reportData: Partial<NspPropertyIndividualReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.nspPropertyIndividualReport || {}), ...reportData };
      await caseService.updateCase(caseId, { nspPropertyIndividualReport: updatedReport as NspPropertyIndividualReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, nspPropertyIndividualReport: updatedReport as NspPropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update NSP Property Individual report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateEntryRestrictedPropertyIndividualReport = async (caseId: string, reportData: Partial<EntryRestrictedPropertyIndividualReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.entryRestrictedPropertyIndividualReport || {}), ...reportData };
      await caseService.updateCase(caseId, { entryRestrictedPropertyIndividualReport: updatedReport as EntryRestrictedPropertyIndividualReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, entryRestrictedPropertyIndividualReport: updatedReport as EntryRestrictedPropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update ERT Property Individual report.');
      console.error(err);
      fetchCases();
    }
  };

  const updateUntraceablePropertyIndividualReport = async (caseId: string, reportData: Partial<UntraceablePropertyIndividualReportData>) => {
    try {
      const caseToUpdate = cases.find(c => c.id === caseId);
      if (!caseToUpdate) throw new Error("Case not found");
      const updatedReport = { ...(caseToUpdate.untraceablePropertyIndividualReport || {}), ...reportData };
      await caseService.updateCase(caseId, { untraceablePropertyIndividualReport: updatedReport as UntraceablePropertyIndividualReportData });
      setCases(prevCases => prevCases.map(c => 
        c.id === caseId 
          ? { ...c, untraceablePropertyIndividualReport: updatedReport as UntraceablePropertyIndividualReportData, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err) {
      setError('Failed to update Untraceable Property Individual report.');
      console.error(err);
      fetchCases();
    }
  };

  const toggleSaveCase = async (caseId: string, isSaved: boolean) => {
    try {
      const updates: Partial<Case> = { isSaved };
      if (isSaved) {
        updates.savedAt = new Date().toISOString();
      }
      await caseService.updateCase(caseId, updates);
      fetchCases();
    } catch (err) {
      setError('Failed to update save status.');
      console.error(err);
    }
  };
  
  const revokeCase = async (caseId: string, reason: RevokeReason) => {
    try {
        await caseService.revokeCase(caseId, reason);
        fetchCases(); // Refetch to update UI
    } catch (err) {
        setError('Failed to revoke case.');
        console.error(err);
    }
  };

  const reorderInProgressCase = async (caseId: string, direction: 'up' | 'down') => {
    try {
        const inProgressCases = cases
            .filter(c => c.status === CaseStatus.InProgress && !c.isSaved)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIndex = inProgressCases.findIndex(c => c.id === caseId);
        if (currentIndex === -1) return;

        let swapIndex;
        if (direction === 'up' && currentIndex > 0) {
            swapIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < inProgressCases.length - 1) {
            swapIndex = currentIndex + 1;
        } else {
            return; // Cannot move further
        }

        const caseA = inProgressCases[currentIndex];
        const caseB = inProgressCases[swapIndex];

        // Swap order
        const orderA = caseA.order;
        const orderB = caseB.order;

        await Promise.all([
            caseService.updateCase(caseA.id, { order: orderB }),
            caseService.updateCase(caseB.id, { order: orderA }),
        ]);

        fetchCases();

    } catch (err) {
        setError('Failed to reorder cases.');
        console.error(err);
    }
  };

  const syncCases = async () => {
    setSyncing(true);
    setError(null);
    try {
      const serverData = await caseService.syncWithServer();

      // Preserve local status changes that haven't been synced to server
      const mergedCases = serverData.map(serverCase => {
        const localCase = cases.find(c => c.id === serverCase.id);

        // If we have a local case with a different status, preserve the local status
        // unless the server case has been updated more recently
        if (localCase && localCase.status !== serverCase.status) {
          const localUpdatedAt = new Date(localCase.updatedAt || localCase.createdAt);
          const serverUpdatedAt = new Date(serverCase.updatedAt || serverCase.createdAt);

          // If local case was updated more recently, preserve local status
          if (localUpdatedAt > serverUpdatedAt) {
            return {
              ...serverCase,
              status: localCase.status,
              updatedAt: localCase.updatedAt,
              inProgressAt: localCase.inProgressAt,
              completedAt: localCase.completedAt,
              submissionStatus: localCase.submissionStatus,
              isSaved: localCase.isSaved
            };
          }
        }

        return serverCase;
      });

      // Add any local cases that don't exist on server (shouldn't happen, but safety check)
      const serverCaseIds = new Set(serverData.map(c => c.id));
      const localOnlyCases = cases.filter(c => !serverCaseIds.has(c.id));

      const finalCases = [...mergedCases, ...localOnlyCases];
      setCases(finalCases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (err) {
      setError('Failed to sync cases.');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  // Note: submitCase and resubmitCase methods have been removed
  // Case submission should now be handled through VerificationFormService
  // in the individual form components

  // Priority management functions
  const setCasePriority = (caseId: string, priority: number | null) => {
    if (priority === null || priority === undefined) {
      priorityService.removePriority(caseId);
    } else {
      priorityService.setPriority(caseId, priority);
    }
  };

  const getCasePriority = (caseId: string): number | null => {
    return priorityService.getPriority(caseId);
  };

  const getCasesWithPriorities = (): Case[] => {
    const priorities = priorityService.getAllPriorities();
    return cases.map(caseItem => ({
      ...caseItem,
      priority: priorities[caseItem.id] || undefined
    }));
  };

  // Clean up priorities for non-existent cases on load
  useEffect(() => {
    if (cases.length > 0) {
      const caseIds = cases.map(c => c.id);
      priorityService.cleanupPriorities(caseIds);
    }
  }, [cases]);

  return (
    <CaseContext.Provider value={{
      cases,
      loading,
      syncing,
      error,
      fetchCases,
      updateCaseStatus,
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
      toggleSaveCase,
      revokeCase,
      reorderInProgressCase,
      syncCases,
      setCasePriority,
      getCasePriority,
      getCasesWithPriorities,
    }}>
      {children}
    </CaseContext.Provider>
  );
};

export const useCases = (): CaseContextType => {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCases must be used within a CaseProvider');
  }
  return context;
};