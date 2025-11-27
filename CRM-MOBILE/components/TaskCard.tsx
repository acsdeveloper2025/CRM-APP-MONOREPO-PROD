import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Case, CaseStatus, VerificationType, VerificationOutcome, RevokeReason } from '../types';
import { useTasks } from "./context/TaskContext"
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, XIcon, InfoIcon, ArrowUpIcon, ArrowDownIcon, AttachmentIcon } from './Icons';
import Spinner from './Spinner';
import Modal from './Modal';
import PriorityInput from './PriorityInput';
import { useTaskAutoSaveStatus } from "./hooks/useTaskAutoSaveStatus"
import CaseTimeline from "./components/TaskTimeline"
import AttachmentsModal from './AttachmentsModal';
import { VerificationTaskService } from '../services/verificationTaskService';
import VerificationFormService from '../services/verificationFormService';
import PositiveResidenceForm from './forms/residence/PositiveResidenceForm';
import { attachmentService } from '../services/attachmentService';
import ShiftedResidenceForm from './forms/residence/ShiftedResidenceForm';
import NspResidenceForm from './forms/residence/NspResidenceForm';
import EntryRestrictedResidenceForm from './forms/residence/EntryRestrictedResidenceForm';
import UntraceableResidenceForm from './forms/residence/UntraceableResidenceForm';
import PositiveResiCumOfficeForm from './forms/residence-cum-office/PositiveResiCumOfficeForm';
import ShiftedResiCumOfficeForm from './forms/residence-cum-office/ShiftedResiCumOfficeForm';
import NspResiCumOfficeForm from './forms/residence-cum-office/NspResiCumOfficeForm';
import EntryRestrictedResiCumOfficeForm from './forms/residence-cum-office/EntryRestrictedResiCumOfficeForm';
import UntraceableResiCumOfficeForm from './forms/residence-cum-office/UntraceableResiCumOfficeForm';
import PositiveOfficeForm from './forms/office/PositiveOfficeForm';
import ShiftedOfficeForm from './forms/office/ShiftedOfficeForm';
import NspOfficeForm from './forms/office/NspOfficeForm';
import EntryRestrictedOfficeForm from './forms/office/EntryRestrictedOfficeForm';
import UntraceableOfficeForm from './forms/office/UntraceableOfficeForm';
import PositiveBusinessForm from './forms/business/PositiveBusinessForm';
import ShiftedBusinessForm from './forms/business/ShiftedBusinessForm';
import NspBusinessForm from './forms/business/NspBusinessForm';
import EntryRestrictedBusinessForm from './forms/business/EntryRestrictedBusinessForm';
import UntraceableBusinessForm from './forms/business/UntraceableBusinessForm';
import PositiveBuilderForm from './forms/builder/PositiveBuilderForm';
import ShiftedBuilderForm from './forms/builder/ShiftedBuilderForm';
import NspBuilderForm from './forms/builder/NspBuilderForm';
import EntryRestrictedBuilderForm from './forms/builder/EntryRestrictedBuilderForm';
import UntraceableBuilderForm from './forms/builder/UntraceableBuilderForm';
import PositiveNocForm from './forms/noc/PositiveNocForm';
import ShiftedNocForm from './forms/noc/ShiftedNocForm';
import NspNocForm from './forms/noc/NspNocForm';
import EntryRestrictedNocForm from './forms/noc/EntryRestrictedNocForm';
import UntraceableNocForm from './forms/noc/UntraceableNocForm';
import PositiveDsaForm from './forms/dsa-dst-connector/PositiveDsaForm';
import ShiftedDsaForm from './forms/dsa-dst-connector/ShiftedDsaForm';
import NspDsaForm from './forms/dsa-dst-connector/NspDsaForm';
import EntryRestrictedDsaForm from './forms/dsa-dst-connector/EntryRestrictedDsaForm';
import UntraceableDsaForm from './forms/dsa-dst-connector/UntraceableDsaForm';
import PositiveNegativePropertyApfForm from './forms/property-apf/PositiveNegativePropertyApfForm';
import EntryRestrictedPropertyApfForm from './forms/property-apf/EntryRestrictedPropertyApfForm';
import UntraceablePropertyApfForm from './forms/property-apf/UntraceablePropertyApfForm';
import PositivePropertyIndividualForm from './forms/property-individual/PositivePropertyIndividualForm';
import NspPropertyIndividualForm from './forms/property-individual/NspPropertyIndividualForm';
import EntryRestrictedPropertyIndividualForm from './forms/property-individual/EntryRestrictedPropertyIndividualForm';
import UntraceablePropertyIndividualForm from './forms/property-individual/UntraceablePropertyIndividualForm';
import { SelectField } from './FormControls';

interface TaskCardProps {
  taskData: VerificationTask;
  isReorderable?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const getEnumOptions = (enumObject: object): React.ReactElement[] => Object.values(enumObject).map(value => (
  <option key={value} value={value}>{value}</option>
));

const commonOutcomes = {
    PositiveAndDoorLocked: VerificationOutcome.PositiveAndDoorLocked,
    ShiftedAndDoorLocked: VerificationOutcome.ShiftedAndDoorLocked,
    NSPAndDoorLocked: VerificationOutcome.NSPAndDoorLocked,
    ERT: VerificationOutcome.ERT,
    Untraceable: VerificationOutcome.Untraceable,
};

const verificationOptionsMap: { [key in VerificationType]?: React.ReactElement[] } = {
    [VerificationType.Residence]: getEnumOptions(commonOutcomes),
    [VerificationType.ResidenceCumOffice]: getEnumOptions(commonOutcomes),
    [VerificationType.Office]: getEnumOptions(commonOutcomes),
    [VerificationType.Business]: getEnumOptions(commonOutcomes),
    [VerificationType.Builder]: getEnumOptions(commonOutcomes),
    [VerificationType.NOC]: getEnumOptions(commonOutcomes),
    [VerificationType.Connector]: getEnumOptions(commonOutcomes),
    [VerificationType.PropertyAPF]: getEnumOptions({
        PositiveAndDoorLocked: VerificationOutcome.PositiveAndDoorLocked,
        ERT: VerificationOutcome.ERT,
        Untraceable: VerificationOutcome.Untraceable,
    }),
    [VerificationType.PropertyIndividual]: getEnumOptions({
        PositiveAndDoorLocked: VerificationOutcome.PositiveAndDoorLocked,
        NSPAndDoorLocked: VerificationOutcome.NSPAndDoorLocked,
        ERT: VerificationOutcome.ERT,
        Untraceable: VerificationOutcome.Untraceable,
    }),
};

const TaskCard: React.FC<CaseCardProps> = ({ taskData, isReorderable = false, isFirst, isLast }) => {
  const { updateTaskStatus, updateVerificationOutcome, reorderInProgressCase, updateCaseSubmissionStatus, verifyCaseSubmissionStatus, fetchCases } = useTasks();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState<RevokeReason>(RevokeReason.NotMyArea);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);

  // Enhanced state for Accept button
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);
  const [showAcceptSuccess, setShowAcceptSuccess] = useState(false);

  // State for real attachment count
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const [attachmentCountLoaded, setAttachmentCountLoaded] = useState<boolean>(false);

  // Check for auto-saved data for this case
  const { hasAutoSaveData } = useTaskAutoSaveStatus(taskData.id);

  // Fetch real attachment count
  useEffect(() => {
    const fetchAttachmentCount = async () => {
      if (!attachmentCountLoaded) {
        try {
          const attachments = await attachmentService.getCaseAttachments(taskData.id);
          setAttachmentCount(attachments.length);
          setAttachmentCountLoaded(true);
        } catch (error) {
          console.error('Failed to fetch attachment count:', error);
          setAttachmentCount(0);
          setAttachmentCountLoaded(true);
        }
      }
    };

    fetchAttachmentCount();
  }, [taskData.id, attachmentCountLoaded]);
  const [isFormExpanding, setIsFormExpanding] = useState(false);
  const [isFormScrollable, setIsFormScrollable] = useState(false);
  const formContentRef = useRef<HTMLDivElement>(null);
  
  const isAssigned = (taskData.taskStatus || taskData.status) === TaskStatus.Assigned;
  const isInProgress = (taskData.taskStatus || taskData.status) === TaskStatus.InProgress;



  const handleOutcomeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Prevent event bubbling to avoid card collapse
    e.stopPropagation();

    const newOutcome = e.target.value as VerificationOutcome || null;
    updateVerificationOutcome(taskData.id, newOutcome);

    // Automatically expand the card to show the form when an outcome is selected
    if (newOutcome && !isExpanded) {
      setIsFormExpanding(true);
      setIsExpanded(true);

      // Scroll to the form content after a brief delay to allow expansion animation
      setTimeout(() => {
        setIsFormExpanding(false);
        if (formContentRef.current) {
          // Scroll the form container into view
          formContentRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });

          // Reset the form's internal scroll position to top
          formContentRef.current.scrollTop = 0;

          // Check if content is scrollable
          const isScrollable = formContentRef.current.scrollHeight > formContentRef.current.clientHeight;
          setIsFormScrollable(isScrollable);
        }
      }, 300); // Wait for expansion animation to start
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeReason || !taskData.verificationTaskId) {
      console.error('❌ Cannot revoke: Missing reason or task ID');
      return;
    }

    setIsRevoking(true);

    try {
      const result = await VerificationTaskService.revokeTask(
        taskData.verificationTaskId,
        revokeReason
      );

      if (result.success) {
        console.log('✅ Task revoked successfully');
        setIsRevokeModalOpen(false);
        // Refresh cases to update the UI
        await fetchCases();
      } else {
        console.error('❌ Failed to revoke task:', result.error);
        alert(`Failed to revoke task: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error revoking task:', error);
      alert('An error occurred while revoking the task');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleSubmitCase = async () => {
    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      console.log('📤 Submitting case from completed tab...');

      // Determine verification type from case data
      const verificationType = taskData.verificationType?.toLowerCase().replace(/\s+/g, '-') as any;

      // Update submission status to 'submitting'
      await updateCaseSubmissionStatus(taskData.id, 'submitting');

      // Retry the verification submission with verificationTaskId
      const result = await VerificationFormService.retryVerificationSubmission(
        taskData.id,
        verificationType,
        taskData.verificationTaskId
      );

      if (result.success) {
        // Update submission status to 'success'
        await updateCaseSubmissionStatus(taskData.id, 'success');
        setSubmissionMessage('✅ Case submitted successfully!');
        setTimeout(() => setSubmissionMessage(null), 5000);
      } else {
        // Update submission status to 'failed' with error message
        await updateCaseSubmissionStatus(taskData.id, 'failed', result.error);
        setSubmissionMessage(`❌ Submission failed: ${result.error}`);
        setTimeout(() => setSubmissionMessage(null), 8000);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await updateCaseSubmissionStatus(taskData.id, 'failed', errorMessage);
      setSubmissionMessage(`❌ Submission failed: ${errorMessage}`);
      setTimeout(() => setSubmissionMessage(null), 8000);
    } finally {
      setIsSubmitting(false);
    }
  };



  /**
   * Verify submission status by checking backend
   */
  const handleVerifySubmission = async () => {
    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      console.log('🔍 Verifying submission status with backend...');

      const result = await verifyCaseSubmissionStatus(taskData.id);

      if (result.submitted) {
        setSubmissionMessage(`✅ Verified: VerificationTask successfully submitted. Task status: ${result.taskStatus}`);
        // Update local status to success
        await updateCaseSubmissionStatus(taskData.id, 'success');
      } else {
        setSubmissionMessage(`⚠️ Not submitted: ${result.error || 'Task not completed on server'}`);
      }

      setTimeout(() => setSubmissionMessage(null), 8000);

    } catch (error) {
      setSubmissionMessage('Verification failed - please try again');
      setTimeout(() => setSubmissionMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Enhanced Accept button handler with optimistic UI and offline support
   */
  const handleAcceptTask = async () => {
    if (isAccepting || (taskData.taskStatus || taskData.status) !== TaskStatus.Assigned) {
      return;
    }

    setIsAccepting(true);
    setAcceptMessage(null);

    try {
      console.log(`🎯 Accepting task ${taskData.id}...`);

      // ✅ OFFLINE-FIRST: Use CaseContext's updateTaskStatus for immediate local update
      // This updates local state instantly and syncs with backend in background
      await updateTaskStatus(taskData.id, TaskStatus.InProgress);

      // Show success feedback
      setShowAcceptSuccess(true);
      setAcceptMessage('Task accepted successfully!');

      // Clear success state after animation
      setTimeout(() => {
        setShowAcceptSuccess(false);
        setAcceptMessage(null);
      }, 2000);

      console.log(`✅ Task ${taskData.id} accepted successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept task';
      setAcceptMessage(errorMessage);
      console.error(`❌ Error accepting task:`, error);

      // Clear error message after 5 seconds
      setTimeout(() => setAcceptMessage(null), 5000);
    } finally {
      setIsAccepting(false);
    }
  };

  const getStatusColor = () => {
    const currentStatus = taskData.taskStatus || taskData.status;
    if (currentStatus === TaskStatus.Completed) {
      switch (taskData.submissionStatus) {
        case 'success':
          return 'border-l-4 border-green-500 bg-green-900/20';
        case 'failed':
          return 'border-l-4 border-red-500 bg-red-900/20';
        case 'submitting':
          return 'border-l-4 border-yellow-500 bg-yellow-900/20';
        case 'pending':
        default:
          return 'border-l-4 border-red-500 bg-red-900/20'; // Red for pending - action required
      }
    }

    const statusColor = {
      [TaskStatus.Assigned]: 'border-l-4 border-blue-500',
      [TaskStatus.InProgress]: 'border-l-4 border-yellow-500',
      [TaskStatus.Completed]: 'border-l-4 border-green-500',
    };

    return statusColor[currentStatus];
  };
  
  const verificationOutcomeOptions = useMemo(() => verificationOptionsMap[taskData.verificationType], [taskData.verificationType]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return null;
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getPriorityText = (priority: number | string): string => {
    const priorityNum = typeof priority === 'string' ? parseInt(priority) : priority;
    switch (priorityNum) {
      case 1: return 'Low';
      case 2: return 'Medium';
      case 3: return 'High';
      case 4: return 'Urgent';
      default: return 'Medium';
    }
  };

  const getTimestampInfo = () => {
      if (taskData.isSaved) {
          return { label: 'Saved', value: formatDate(taskData.savedAt) };
      }
      const currentStatus = taskData.taskStatus || taskData.status;
      switch (currentStatus) {
          case TaskStatus.Assigned:
              return { label: 'Assigned', value: formatDate(taskData.createdAt) };
          case TaskStatus.InProgress:
              return { label: 'Started', value: formatDate(taskData.inProgressAt) };
          case TaskStatus.Completed:
              return { label: 'Completed', value: formatDate(taskData.completedAt) };
          default:
              return { label: 'Updated', value: formatDate(taskData.updatedAt) };
      }
  };

  const timestamp = getTimestampInfo();

  const renderOutcomeSelectionPrompt = () => (
    <div style={{
      textAlign: 'center',
      padding: '24px 16px',
      margin: '16px 0',
      backgroundColor: '#1F2937',
      borderRadius: '8px',
      border: '2px dashed #374151'
    }}>
      <div style={{ color: '#00a950', marginBottom: '8px', fontSize: '24px' }}>📋</div>
      <p style={{ color: '#F9FAFB', fontWeight: '600', marginBottom: '4px' }}>
        Select Verification Outcome
      </p>
      <p style={{ color: '#9CA3AF', fontSize: '14px' }}>
        Choose an outcome from the dropdown above to automatically open the verification form
      </p>
    </div>
  );

  const renderFormContent = () => {
    if (taskData.verificationType === VerificationType.Residence) {
      switch (taskData.verificationOutcome) {
        case VerificationOutcome.PositiveAndDoorLocked:
          return taskData.residenceReport ? <PositiveResidenceForm taskData={taskData} /> : <p>Loading Residence Form...</p>;
        case VerificationOutcome.ShiftedAndDoorLocked:
          return taskData.shiftedResidenceReport ? <ShiftedResidenceForm taskData={taskData} /> : <p>Loading Shifted Residence Form...</p>;
        case VerificationOutcome.NSPAndDoorLocked:
          return taskData.nspResidenceReport ? <NspResidenceForm taskData={taskData} /> : <p>Loading NSP Residence Form...</p>;
        case VerificationOutcome.ERT:
            return taskData.entryRestrictedResidenceReport ? <EntryRestrictedResidenceForm taskData={taskData} /> : <p>Loading Entry Restricted Form...</p>;
        case VerificationOutcome.Untraceable:
            return taskData.untraceableResidenceReport ? <UntraceableResidenceForm taskData={taskData} /> : <p>Loading Untraceable Residence Form...</p>;
        default:
            return renderOutcomeSelectionPrompt();
      }
    }

    if (taskData.verificationType === VerificationType.ResidenceCumOffice) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.resiCumOfficeReport ? <PositiveResiCumOfficeForm taskData={taskData} /> : <p>Loading Resi-cum-Office Form...</p>;
            case VerificationOutcome.ShiftedAndDoorLocked:
                return taskData.shiftedResiCumOfficeReport ? <ShiftedResiCumOfficeForm taskData={taskData} /> : <p>Loading Shifted Resi-cum-Office Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspResiCumOfficeReport ? <NspResiCumOfficeForm taskData={taskData} /> : <p>Loading NSP Resi-cum-Office Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedResiCumOfficeReport ? <EntryRestrictedResiCumOfficeForm taskData={taskData} /> : <p>Loading ERT Resi-cum-Office Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceableResiCumOfficeReport ? <UntraceableResiCumOfficeForm taskData={taskData} /> : <p>Loading Untraceable Resi-cum-Office Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    if (taskData.verificationType === VerificationType.Office) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.positiveOfficeReport ? <PositiveOfficeForm taskData={taskData} /> : <p>Loading Office Form...</p>;
            case VerificationOutcome.ShiftedAndDoorLocked:
                return taskData.shiftedOfficeReport ? <ShiftedOfficeForm taskData={taskData} /> : <p>Loading Shifted Office Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspOfficeReport ? <NspOfficeForm taskData={taskData} /> : <p>Loading NSP Office Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedOfficeReport ? <EntryRestrictedOfficeForm taskData={taskData} /> : <p>Loading ERT Office Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceableOfficeReport ? <UntraceableOfficeForm taskData={taskData} /> : <p>Loading Untraceable Office Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    if (taskData.verificationType === VerificationType.Business) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.positiveBusinessReport ? <PositiveBusinessForm taskData={taskData} /> : <p>Loading Business Form...</p>;
            case VerificationOutcome.ShiftedAndDoorLocked:
                return taskData.shiftedBusinessReport ? <ShiftedBusinessForm taskData={taskData} /> : <p>Loading Shifted Business Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspBusinessReport ? <NspBusinessForm taskData={taskData} /> : <p>Loading NSP Business Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedBusinessReport ? <EntryRestrictedBusinessForm taskData={taskData} /> : <p>Loading ERT Business Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceableBusinessReport ? <UntraceableBusinessForm taskData={taskData} /> : <p>Loading Untraceable Business Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }
    
    if (taskData.verificationType === VerificationType.Builder) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.positiveBuilderReport ? <PositiveBuilderForm taskData={taskData} /> : <p>Loading Builder Form...</p>;
            case VerificationOutcome.ShiftedAndDoorLocked:
                return taskData.shiftedBuilderReport ? <ShiftedBuilderForm taskData={taskData} /> : <p>Loading Shifted Builder Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspBuilderReport ? <NspBuilderForm taskData={taskData} /> : <p>Loading NSP Builder Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedBuilderReport ? <EntryRestrictedBuilderForm taskData={taskData} /> : <p>Loading ERT Builder Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceableBuilderReport ? <UntraceableBuilderForm taskData={taskData} /> : <p>Loading Untraceable Builder Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    if (taskData.verificationType === VerificationType.NOC) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.positiveNocReport ? <PositiveNocForm taskData={taskData} /> : <p>Loading NOC Form...</p>;
            case VerificationOutcome.ShiftedAndDoorLocked:
                return taskData.shiftedNocReport ? <ShiftedNocForm taskData={taskData} /> : <p>Loading Shifted NOC Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspNocReport ? <NspNocForm taskData={taskData} /> : <p>Loading NSP NOC Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedNocReport ? <EntryRestrictedNocForm taskData={taskData} /> : <p>Loading ERT NOC Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceableNocReport ? <UntraceableNocForm taskData={taskData} /> : <p>Loading Untraceable NOC Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    if (taskData.verificationType === VerificationType.Connector) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.positiveDsaReport ? <PositiveDsaForm taskData={taskData} /> : <p>Loading DSA/DST Form...</p>;
            case VerificationOutcome.ShiftedAndDoorLocked:
                return taskData.shiftedDsaReport ? <ShiftedDsaForm taskData={taskData} /> : <p>Loading Shifted DSA/DST Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspDsaReport ? <NspDsaForm taskData={taskData} /> : <p>Loading NSP DSA/DST Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedDsaReport ? <EntryRestrictedDsaForm taskData={taskData} /> : <p>Loading ERT DSA/DST Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceableDsaReport ? <UntraceableDsaForm taskData={taskData} /> : <p>Loading Untraceable DSA/DST Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    if (taskData.verificationType === VerificationType.PropertyAPF) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
            case VerificationOutcome.NSPAndDoorLocked:
                return (taskData.positivePropertyApfReport || taskData.nspPropertyApfReport) ?
                    <PositiveNegativePropertyApfForm taskData={taskData} /> :
                    <p>Loading Property APF Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedPropertyApfReport ? <EntryRestrictedPropertyApfForm taskData={taskData} /> : <p>Loading ERT Property APF Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceablePropertyApfReport ? <UntraceablePropertyApfForm taskData={taskData} /> : <p>Loading Untraceable Property APF Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    if (taskData.verificationType === VerificationType.PropertyIndividual) {
        switch (taskData.verificationOutcome) {
            case VerificationOutcome.PositiveAndDoorLocked:
                return taskData.positivePropertyIndividualReport ? <PositivePropertyIndividualForm taskData={taskData} /> : <p>Loading Property Individual Form...</p>;
            case VerificationOutcome.NSPAndDoorLocked:
                return taskData.nspPropertyIndividualReport ? <NspPropertyIndividualForm taskData={taskData} /> : <p>Loading NSP Property Individual Form...</p>;
            case VerificationOutcome.ERT:
                return taskData.entryRestrictedPropertyIndividualReport ? <EntryRestrictedPropertyIndividualForm taskData={taskData} /> : <p>Loading ERT Property Individual Form...</p>;
            case VerificationOutcome.Untraceable:
                return taskData.untraceablePropertyIndividualReport ? <UntraceablePropertyIndividualForm taskData={taskData} /> : <p>Loading Untraceable Property Individual Form...</p>;
            default:
                return renderOutcomeSelectionPrompt();
        }
    }

    return (
        <p className="text-medium-text mt-4">No specific form for this verification type/outcome combination.</p>
    );
  };


  return (
    <>
    <div className={`bg-dark-card rounded-lg shadow-lg mb-4 mx-4 p-4 transition-all duration-300 ${getStatusColor()} ${hasAutoSaveData ? 'ring-2 ring-yellow-400 bg-yellow-900/20 border-yellow-400/50' : ''}`}>
      <div
        className={`flex justify-between items-start ${((taskData.taskStatus || taskData.status) !== TaskStatus.Assigned && (taskData.taskStatus || taskData.status) !== TaskStatus.Completed && !taskData.isSaved) ? 'cursor-pointer' : ''}`}
        onClick={((taskData.taskStatus || taskData.status) !== TaskStatus.Assigned && (taskData.taskStatus || taskData.status) !== TaskStatus.Completed && !taskData.isSaved) ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex-1">
          <div className="flex justify-between items-start">
              <div className="flex-1">
                  {/* 1. Verification Type */}
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">{taskData.verificationType}</p>
                    {hasAutoSaveData && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                        📝 Draft Saved
                      </span>
                    )}
                  </div>

                  {/* 2. Case ID */}
                  <div className="mb-2">
                    <p className="text-sm font-semibold text-light-text">Case ID: #{taskData.caseId || taskData.id?.slice(-8)}</p>
                  </div>

                  {/* 3. Customer Name */}
                  <div className="mb-2">
                    <h3 className="font-bold text-lg text-light-text">{taskData.customerName || taskData.customer.name}</h3>
                  </div>

                  {/* 4. Address */}
                  <div className="mb-2">
                    <p className="text-sm text-medium-text">
                      📍 {taskData.addressStreet || taskData.visitAddress || taskData.address || 'Address not available'}
                    </p>
                  </div>
              </div>
              {timestamp.value && (
                <p className="text-xs text-gray-400 text-right shrink-0 ml-2">
                  {timestamp.label}
                  <br />
                  {timestamp.value}
                </p>
              )}
          </div>
          <div className="flex justify-end items-center mt-2">
            <div className="flex items-center gap-3">
              {/* Show Info button for In Progress cases */}
              {(taskData.taskStatus || taskData.status) === TaskStatus.InProgress && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsInfoModalOpen(true);
                    }}
                    className="flex flex-col items-center text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <InfoIcon />
                    <span className="text-xs mt-1">Info</span>
                </button>
              )}
              {/* Show attachment button for In Progress cases */}
              {(taskData.taskStatus || taskData.status) === TaskStatus.InProgress && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAttachmentsModalOpen(true);
                  }}
                  className="flex flex-col items-center text-purple-400 hover:text-purple-300 transition-colors relative"
                >
                  <AttachmentIcon />
                  <span className="text-xs mt-1">Attachments</span>
                  {attachmentCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {attachmentCount}
                    </span>
                  )}
                </button>
              )}
              {/* Show priority input only for In Progress cases */}
              {(taskData.taskStatus || taskData.status) === TaskStatus.InProgress && !taskData.isSaved && (
                <PriorityInput caseId={taskData.id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Show comprehensive timeline for completed cases */}
      {(taskData.taskStatus || taskData.status) === TaskStatus.Completed && (
        <TaskTimeline taskData={taskData} compact={true} />
      )}

      {/* Submission status and re-submit functionality for completed cases */}
      {(taskData.taskStatus || taskData.status) === TaskStatus.Completed && (
        <div className="mt-3">
          {/* Submission Status Indicator */}
          {taskData.submissionStatus && (
            <div className="mb-3">
              {taskData.submissionStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <span>✅</span>
                  <span>Successfully submitted to server</span>
                </div>
              )}

              {taskData.submissionStatus === 'failed' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <span>❌</span>
                    <span>Submission failed</span>
                  </div>
                  {taskData.submissionError && (
                    <div className="text-xs text-red-300 bg-red-900/20 p-2 rounded border border-red-500/30">
                      {taskData.submissionError}
                    </div>
                  )}
                </div>
              )}

              {taskData.submissionStatus === 'submitting' && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <span>⏳</span>
                  <span>Submitting to server...</span>
                </div>
              )}

              {taskData.submissionStatus === 'pending' && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <span>⚠️</span>
                  <span>Pending submission - Action required</span>
                </div>
              )}
            </div>
          )}

          {/* Submission Message */}
          {submissionMessage && (
            <div className={`mb-3 p-2 rounded text-sm ${
              submissionMessage.includes('✅') || submissionMessage.includes('success')
                ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                : submissionMessage.includes('⚠️')
                ? 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400'
                : 'bg-red-900/20 border border-red-500/30 text-red-400'
            }`}>
              {submissionMessage}
            </div>
          )}

          {/* Action Buttons - Only show Submit button for pending submissions */}
          {taskData.submissionStatus === 'pending' && (
            <div className="flex gap-2 flex-wrap">
              {/* Submit Button */}
              <button
                onClick={handleSubmitCase}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>Submit Case</span>
                  </>
                )}
              </button>

              {/* Verify Submission Button */}
              <button
                onClick={handleVerifySubmission}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Verify Status</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* For security reasons, do NOT render forms in Completed or Saved tabs */}
      {(taskData.taskStatus || taskData.status) !== TaskStatus.Completed && !taskData.isSaved && (
        <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[8000px] mt-4' : 'max-h-0 overflow-hidden'}`}>
          {isInProgress && verificationOutcomeOptions && (
              <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                  <SelectField
                      label="Verification Outcome"
                      id={`outcome-${taskData.id}`}
                      name="verificationOutcome"
                      value={taskData.verificationOutcome || ''}
                      onChange={handleOutcomeChange}
                  >
                      <option value="">Select Outcome...</option>
                      {verificationOutcomeOptions}
                  </SelectField>
              </div>
          )}
          <div
            ref={formContentRef}
            style={{
              maxHeight: isExpanded ? '70vh' : '0',
              overflowY: isExpanded ? 'auto' : 'hidden',
              overflowX: 'hidden',
              transition: 'max-height 0.5s ease-in-out',
              // Custom scrollbar styling
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #1F2937'
            }}
            className="custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {isFormExpanding ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px',
                color: '#9CA3AF'
              }}>
                <Spinner size="small" />
                <span style={{ marginLeft: '8px', fontSize: '14px' }}>Opening form...</span>
              </div>
            ) : (
              <div style={{
                paddingRight: '8px',
                paddingBottom: '16px',
                paddingTop: '8px'
              }}>
                {renderFormContent()}
                {isFormScrollable && (
                  <div style={{
                    position: 'sticky',
                    bottom: '0',
                    textAlign: 'center',
                    padding: '8px',
                    background: 'linear-gradient(transparent, #1F2937)',
                    color: '#9CA3AF',
                    fontSize: '12px',
                    pointerEvents: 'none'
                  }}>
                    ↓ Scroll down for more fields ↓
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-dark-border">
        {isAssigned ? (
            <div className="flex justify-around items-center">
                <button
                    onClick={handleAcceptTask}
                    disabled={isAccepting}
                    className={`
                      flex flex-col items-center transition-all duration-200
                      ${isAccepting
                        ? 'text-gray-400 cursor-not-allowed'
                        : showAcceptSuccess
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
                      ) : showAcceptSuccess ? (
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
                        : showAcceptSuccess
                        ? 'text-green-300 font-semibold'
                        : 'text-current'
                    }`}>
                      {isAccepting ? 'Accepting...' : showAcceptSuccess ? 'Accepted!' : 'Accept'}
                    </span>
                </button>
                <button 
                    onClick={() => setIsRevokeModalOpen(true)}
                    className="flex flex-col items-center text-red-400 hover:text-red-300 transition-colors"
                >
                    <XIcon />
                    <span className="text-xs mt-1">Revoke</span>
                </button>
                <button
                    onClick={() => setIsInfoModalOpen(true)}
                    className="flex flex-col items-center text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <InfoIcon />
                    <span className="text-xs mt-1">Info</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAttachmentsModalOpen(true);
                    }}
                    className="flex flex-col items-center text-purple-400 hover:text-purple-300 transition-colors relative"
                >
                    <AttachmentIcon />
                    <span className="text-xs mt-1">Attachments</span>
                    {attachmentCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {attachmentCount}
                        </span>
                    )}
                </button>
            </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              {isReorderable ? (
                <div className="flex items-center space-x-2">
                  <button onClick={(e) => { e.stopPropagation(); reorderInProgressCase(taskData.id, 'up'); }} disabled={isFirst} className="p-2 rounded-full disabled:text-gray-600 disabled:cursor-not-allowed text-medium-text hover:text-light-text transition-colors">
                      <ArrowUpIcon />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); reorderInProgressCase(taskData.id, 'down'); }} disabled={isLast} className="p-2 rounded-full disabled:text-gray-600 disabled:cursor-not-allowed text-medium-text hover:text-light-text transition-colors">
                      <ArrowDownIcon />
                  </button>
                </div>
              ) : <div />}
            </div>

            <div className="flex items-center gap-2">
              {taskData.isSaved && (taskData.taskStatus || taskData.status) !== TaskStatus.Completed && (
                  <button
                      onClick={async (e) => {
                          e.stopPropagation();
                          // First mark as completed, then submit
                          await updateTaskStatus(taskData.id, TaskStatus.Completed);
                          // The submission will be handled by the re-submit button that appears for completed cases
                      }}
                      className="px-4 py-2 text-sm font-semibold rounded-md bg-green-600 hover:bg-green-500 text-white transition-colors"
                  >
                      Complete Case
                  </button>
              )}

              {/* Only show expand/collapse button for non-completed and non-saved cases */}
              {!((taskData.taskStatus || taskData.status) === TaskStatus.Completed || taskData.isSaved) && (
                <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-medium-text p-2 rounded-md hover:bg-white/10">
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    <span className="text-xs ml-1">
                        {isExpanded ? 'Hide Details' : 'Select Outcome'}
                    </span>
                </button>
              )}
            </div>
        </div>
        )}
      </div>
    </div>

    <Modal isVisible={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Case Information">
        <div className="text-light-text space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {/* 1. Customer Name */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Customer Name *</h4>
                    <p>{taskData.customerName || taskData.customer.name || 'N/A'}</p>
                </div>

                {/* 2. Case ID */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Case ID *</h4>
                    <p>#{taskData.caseId || taskData.id?.slice(-8) || 'N/A'}</p>
                </div>

                {/* 2.5. Verification Task ID */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Verification Task ID</h4>
                    <p>{taskData.verificationTaskNumber ? `#${taskData.verificationTaskNumber}` : 'N/A'}</p>
                </div>

                {/* 3. Client */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Client *</h4>
                    <p>{taskData.client?.name || taskData.clientName || 'N/A'}</p>
                </div>

                {/* 4. Product */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Product *</h4>
                    <p>{typeof taskData.product === 'object' && taskData.product?.name ? taskData.product.name : taskData.productName || 'N/A'}</p>
                </div>

                {/* 5. Verification Type */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Verification Type *</h4>
                    <p>{taskData.verificationTypeName || taskData.verificationType || 'N/A'}</p>
                </div>

                {/* 6. Applicant Type */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Applicant Type *</h4>
                    <p>{taskData.applicantType || 'N/A'}</p>
                </div>

                {/* 7. Created By Backend User */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Created By Backend User *</h4>
                    <p>{taskData.createdByBackendUserName || taskData.createdByBackendUser || 'N/A'}</p>
                </div>

                {/* 8. Backend Contact Number */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Backend Contact Number *</h4>
                    <p>{taskData.backendContactNumber || taskData.systemContactNumber || 'N/A'}</p>
                </div>

                {/* 9. Assign to Field User */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Assign to Field User *</h4>
                    <p>{taskData.assignedToFieldUser || taskData.assignedToName || 'N/A'}</p>
                </div>

                {/* 10. Priority */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Priority *</h4>
                    <p>{getPriorityText(taskData.priority) || 'N/A'}</p>
                </div>

                {/* 11. TRIGGER */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">TRIGGER *</h4>
                    <p>{taskData.notes || taskData.trigger || 'N/A'}</p>
                </div>

                {/* 12. Customer Calling Code */}
                <div>
                    <h4 className="font-bold text-sm text-medium-text">Customer Calling Code *</h4>
                    <p>{taskData.customerCallingCode || 'N/A'}</p>
                </div>

                {/* 13. Address */}
                <div className="sm:col-span-2">
                    <h4 className="font-bold text-sm text-medium-text">Address *</h4>
                    <p>{taskData.addressStreet || taskData.visitAddress || taskData.address || 'N/A'}</p>
                </div>
            </div>
             <div className="flex justify-end pt-4">
                <button
                    onClick={() => setIsInfoModalOpen(false)}
                    className="px-4 py-2 rounded-md bg-brand-primary hover:bg-brand-secondary text-white font-semibold"
                >
                    Close
                </button>
            </div>
        </div>
    </Modal>

    <Modal isVisible={isRevokeModalOpen} onClose={() => !isRevoking && setIsRevokeModalOpen(false)} title="Revoke Task">
        <div className="space-y-4">
            <SelectField
                label="Reason for Revocation"
                id={`revoke-reason-${taskData.id}`}
                name="revokeReason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value as RevokeReason)}
                disabled={isRevoking}
            >
                {Object.values(RevokeReason).map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                ))}
            </SelectField>
            <p className="text-sm text-medium-text">
                This will revoke the verification task and notify backend users. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4 mt-6">
                <button
                    onClick={() => setIsRevokeModalOpen(false)}
                    disabled={isRevoking}
                    className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-light-text font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    onClick={handleRevokeConfirm}
                    disabled={isRevoking}
                    className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isRevoking && <Spinner size="small" />}
                    {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
                </button>
            </div>
        </div>
    </Modal>

    {/* Attachments Modal */}
    <AttachmentsModal
      caseId={taskData.id}
      isVisible={isAttachmentsModalOpen}
      onClose={() => setIsAttachmentsModalOpen(false)}
    />

    </>
  );
};

export default TaskCard;