import AsyncStorage from '../polyfills/AsyncStorage';

export interface SubmissionStep {
  id: string;
  name: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number; // 0-100
  startTime?: string;
  endTime?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SubmissionProgress {
  id: string;
  caseId: string;
  verificationType: string;
  status: 'PREPARING' | 'UPLOADING' | 'SUBMITTING' | 'COMPLETED' | 'FAILED';
  overallProgress: number; // 0-100
  currentStep: string;
  steps: SubmissionStep[];
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: number; // in seconds
  bytesUploaded?: number;
  totalBytes?: number;
  uploadSpeed?: number; // bytes per second
}

export interface ProgressCallback {
  (progress: SubmissionProgress): void;
}

class ProgressTrackingService {
  private static readonly STORAGE_KEY = 'submission_progress';
  private activeSubmissions: Map<string, SubmissionProgress> = new Map();
  private progressCallbacks: Map<string, ProgressCallback[]> = new Map();
  private stepTemplates: Map<string, SubmissionStep[]> = new Map();

  constructor() {
    this.initializeStepTemplates();
    this.loadActiveSubmissions();
  }

  /**
   * Initialize step templates for different verification types
   */
  private initializeStepTemplates() {
    const commonSteps: SubmissionStep[] = [
      {
        id: 'validation',
        name: 'Validating Form Data',
        description: 'Checking form completeness and photo requirements',
        status: 'PENDING',
        progress: 0
      },
      {
        id: 'compression',
        name: 'Optimizing Data',
        description: 'Compressing images and form data for upload',
        status: 'PENDING',
        progress: 0
      },
      {
        id: 'upload_photos',
        name: 'Uploading Photos',
        description: 'Uploading geo-tagged verification photos',
        status: 'PENDING',
        progress: 0
      },
      {
        id: 'submit_form',
        name: 'Submitting Verification',
        description: 'Sending verification form to server',
        status: 'PENDING',
        progress: 0
      },
      {
        id: 'confirmation',
        name: 'Processing Confirmation',
        description: 'Receiving and processing server confirmation',
        status: 'PENDING',
        progress: 0
      }
    ];

    // Set templates for all verification types
    const verificationTypes = [
      'residence', 'office', 'business', 'builder', 
      'residence-cum-office', 'dsa-connector', 
      'property-individual', 'property-apf', 'noc'
    ];

    verificationTypes.forEach(type => {
      this.stepTemplates.set(type, [...commonSteps]);
    });
  }

  /**
   * Start tracking a new submission
   */
  startSubmission(
    caseId: string, 
    verificationType: string,
    totalBytes?: number
  ): string {
    const submissionId = `submission_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const steps = this.stepTemplates.get(verificationType) || this.stepTemplates.get('residence')!;
    
    const progress: SubmissionProgress = {
      id: submissionId,
      caseId,
      verificationType,
      status: 'PREPARING',
      overallProgress: 0,
      currentStep: steps[0].id,
      steps: steps.map(step => ({ ...step })), // Deep copy
      startTime: new Date().toISOString(),
      totalBytes,
      bytesUploaded: 0,
      uploadSpeed: 0
    };

    this.activeSubmissions.set(submissionId, progress);
    this.saveActiveSubmissions();
    
    console.log(`📊 Started tracking submission: ${submissionId} for case ${caseId}`);
    this.notifyProgress(submissionId);
    
    return submissionId;
  }

  /**
   * Update step progress
   */
  updateStepProgress(
    submissionId: string,
    stepId: string,
    progress: number,
    status?: SubmissionStep['status'],
    metadata?: Record<string, any>
  ) {
    const submission = this.activeSubmissions.get(submissionId);
    if (!submission) return;

    const step = submission.steps.find(s => s.id === stepId);
    if (!step) return;

    // Update step
    step.progress = Math.max(0, Math.min(100, progress));
    if (status) {
      step.status = status;
      
      if (status === 'IN_PROGRESS' && !step.startTime) {
        step.startTime = new Date().toISOString();
      }
      
      if ((status === 'COMPLETED' || status === 'FAILED') && !step.endTime) {
        step.endTime = new Date().toISOString();
      }
    }
    
    if (metadata) {
      step.metadata = { ...step.metadata, ...metadata };
    }

    // Update current step
    if (status === 'IN_PROGRESS') {
      submission.currentStep = stepId;
    }

    // Calculate overall progress
    const totalSteps = submission.steps.length;
    const completedSteps = submission.steps.filter(s => s.status === 'COMPLETED').length;
    const currentStepProgress = submission.steps.find(s => s.id === submission.currentStep)?.progress || 0;
    
    submission.overallProgress = Math.round(
      ((completedSteps * 100) + currentStepProgress) / totalSteps
    );

    // Update submission status
    if (submission.steps.every(s => s.status === 'COMPLETED')) {
      submission.status = 'COMPLETED';
      submission.endTime = new Date().toISOString();
    } else if (submission.steps.some(s => s.status === 'FAILED')) {
      submission.status = 'FAILED';
      submission.endTime = new Date().toISOString();
    } else if (submission.steps.some(s => s.status === 'IN_PROGRESS')) {
      submission.status = 'SUBMITTING';
    }

    // Calculate estimated time remaining
    this.calculateTimeEstimate(submission);

    this.saveActiveSubmissions();
    this.notifyProgress(submissionId);
  }

  /**
   * Update upload progress with bytes transferred
   */
  updateUploadProgress(
    submissionId: string,
    bytesUploaded: number,
    uploadSpeed?: number
  ) {
    const submission = this.activeSubmissions.get(submissionId);
    if (!submission) return;

    submission.bytesUploaded = bytesUploaded;
    if (uploadSpeed !== undefined) {
      submission.uploadSpeed = uploadSpeed;
    }

    // Update upload step progress
    if (submission.totalBytes && submission.totalBytes > 0) {
      const uploadProgress = Math.round((bytesUploaded / submission.totalBytes) * 100);
      this.updateStepProgress(submissionId, 'upload_photos', uploadProgress, 'IN_PROGRESS', {
        bytesUploaded,
        totalBytes: submission.totalBytes,
        uploadSpeed
      });
    }
  }

  /**
   * Mark submission as failed with error
   */
  markSubmissionFailed(submissionId: string, error: string, failedStepId?: string) {
    const submission = this.activeSubmissions.get(submissionId);
    if (!submission) return;

    submission.status = 'FAILED';
    submission.endTime = new Date().toISOString();

    if (failedStepId) {
      const step = submission.steps.find(s => s.id === failedStepId);
      if (step) {
        step.status = 'FAILED';
        step.error = error;
        step.endTime = new Date().toISOString();
      }
    }

    this.saveActiveSubmissions();
    this.notifyProgress(submissionId);
    
    console.error(`❌ Submission ${submissionId} failed:`, error);
  }

  /**
   * Mark submission as completed
   */
  markSubmissionCompleted(submissionId: string) {
    const submission = this.activeSubmissions.get(submissionId);
    if (!submission) return;

    submission.status = 'COMPLETED';
    submission.overallProgress = 100;
    submission.endTime = new Date().toISOString();

    // Mark all steps as completed
    submission.steps.forEach(step => {
      if (step.status !== 'COMPLETED') {
        step.status = 'COMPLETED';
        step.progress = 100;
        step.endTime = new Date().toISOString();
      }
    });

    this.saveActiveSubmissions();
    this.notifyProgress(submissionId);
    
    console.log(`✅ Submission ${submissionId} completed successfully`);

    // Clean up after 5 minutes
    setTimeout(() => {
      this.cleanupSubmission(submissionId);
    }, 5 * 60 * 1000);
  }

  /**
   * Subscribe to progress updates
   */
  subscribeToProgress(submissionId: string, callback: ProgressCallback): () => void {
    if (!this.progressCallbacks.has(submissionId)) {
      this.progressCallbacks.set(submissionId, []);
    }
    
    this.progressCallbacks.get(submissionId)!.push(callback);
    
    // Send current progress immediately
    const submission = this.activeSubmissions.get(submissionId);
    if (submission) {
      callback(submission);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.progressCallbacks.get(submissionId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get current progress for a submission
   */
  getProgress(submissionId: string): SubmissionProgress | null {
    return this.activeSubmissions.get(submissionId) || null;
  }

  /**
   * Get all active submissions
   */
  getAllActiveSubmissions(): SubmissionProgress[] {
    return Array.from(this.activeSubmissions.values());
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateTimeEstimate(submission: SubmissionProgress) {
    if (!submission.startTime) return;

    const elapsed = Date.now() - new Date(submission.startTime).getTime();
    const elapsedSeconds = elapsed / 1000;
    
    if (submission.overallProgress > 0 && submission.overallProgress < 100) {
      const estimatedTotal = (elapsedSeconds * 100) / submission.overallProgress;
      submission.estimatedTimeRemaining = Math.round(estimatedTotal - elapsedSeconds);
    }
  }

  /**
   * Notify progress callbacks
   */
  private notifyProgress(submissionId: string) {
    const submission = this.activeSubmissions.get(submissionId);
    const callbacks = this.progressCallbacks.get(submissionId);
    
    if (submission && callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(submission);
        } catch (error) {
          console.error('Progress callback error:', error);
        }
      });
    }
  }

  /**
   * Clean up completed submission
   */
  private cleanupSubmission(submissionId: string) {
    this.activeSubmissions.delete(submissionId);
    this.progressCallbacks.delete(submissionId);
    this.saveActiveSubmissions();
    
    console.log(`🗑️ Cleaned up submission: ${submissionId}`);
  }

  /**
   * Load active submissions from storage
   */
  private async loadActiveSubmissions() {
    try {
      const stored = await AsyncStorage.getItem(ProgressTrackingService.STORAGE_KEY);
      if (stored) {
        const submissions: SubmissionProgress[] = JSON.parse(stored);
        submissions.forEach(submission => {
          this.activeSubmissions.set(submission.id, submission);
        });
        console.log(`📊 Loaded ${submissions.length} active submissions`);
      }
    } catch (error) {
      console.error('Failed to load active submissions:', error);
    }
  }

  /**
   * Save active submissions to storage
   */
  private async saveActiveSubmissions() {
    try {
      const submissions = Array.from(this.activeSubmissions.values());
      await AsyncStorage.setItem(ProgressTrackingService.STORAGE_KEY, JSON.stringify(submissions));
    } catch (error) {
      console.error('Failed to save active submissions:', error);
    }
  }

  /**
   * Clear all progress data (for testing/debugging)
   */
  async clearAllProgress() {
    this.activeSubmissions.clear();
    this.progressCallbacks.clear();
    await AsyncStorage.removeItem(ProgressTrackingService.STORAGE_KEY);
    console.log('🗑️ All progress data cleared');
  }
}

export default new ProgressTrackingService();
