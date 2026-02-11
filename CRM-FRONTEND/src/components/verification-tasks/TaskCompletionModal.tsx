import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, DollarSign } from 'lucide-react';
import { CompleteVerificationTaskRequest } from '@/types/verificationTask';

interface TaskCompletionModalProps {
  taskId: string;
  onClose: () => void;
  onSubmit: (completionData: CompleteVerificationTaskRequest) => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  taskId,
  onClose,
  onSubmit
}) => {
  const [verificationOutcome, setVerificationOutcome] = useState<string>('');
  const [actualAmount, setActualAmount] = useState<number | undefined>();
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [formSubmissionId, setFormSubmissionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const outcomeOptions = [
    { value: 'VERIFIED', label: 'Verified', color: 'bg-green-100 text-green-800' },
    { value: 'REJECTED', label: 'Rejected', color: 'bg-red-100 text-red-800' },
    { value: 'PARTIAL', label: 'Partially Verified', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'PENDING_DOCS', label: 'Pending Documents', color: 'bg-yellow-100 text-orange-800' },
    { value: 'NOT_FOUND', label: 'Not Found', color: 'bg-gray-100 text-gray-800' },
    { value: 'INVALID', label: 'Invalid Information', color: 'bg-red-100 text-red-800' }
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!verificationOutcome) {
      newErrors.verificationOutcome = 'Please select a verification outcome';
    }

    if (!completionNotes.trim()) {
      newErrors.completionNotes = 'Please provide completion notes';
    }

    if (actualAmount !== undefined && actualAmount < 0) {
      newErrors.actualAmount = 'Amount cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const completionData: CompleteVerificationTaskRequest = {
      verificationOutcome,
      actualAmount,
      completionNotes,
      formSubmissionId: formSubmissionId || undefined
    };

    try {
      await onSubmit(completionData);
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const getOutcomeColor = (outcome: string) => {
    const option = outcomeOptions.find(opt => opt.value === outcome);
    return option?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Complete Verification Task</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Info */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Task ID: {taskId.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Mark this task as completed
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  Completing
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Completion Form */}
          <div className="space-y-4">
            {/* Verification Outcome */}
            <div className="space-y-2">
              <Label htmlFor="verificationOutcome">
                Verification Outcome <span className="text-red-500">*</span>
              </Label>
              <Select
                value={verificationOutcome}
                onValueChange={(value) => {
                  setVerificationOutcome(value);
                  clearError('verificationOutcome');
                }}
              >
                <SelectTrigger className={errors.verificationOutcome ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select verification outcome">
                    {verificationOutcome && (
                      <Badge className={getOutcomeColor(verificationOutcome)}>
                        {outcomeOptions.find(opt => opt.value === verificationOutcome)?.label}
                      </Badge>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {outcomeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <Badge className={option.color}>
                        {option.label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.verificationOutcome && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.verificationOutcome}</span>
                </p>
              )}
            </div>

            {/* Actual Amount */}
            <div className="space-y-2">
              <Label htmlFor="actualAmount">
                Actual Amount (₹)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="actualAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualAmount || ''}
                  onChange={(e) => {
                    setActualAmount(e.target.value ? parseFloat(e.target.value) : undefined);
                    clearError('actualAmount');
                  }}
                  placeholder="0.00"
                  className={`pl-10 ${errors.actualAmount ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.actualAmount && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.actualAmount}</span>
                </p>
              )}
              <p className="text-xs text-gray-500">
                Enter the actual amount charged for this verification
              </p>
            </div>

            {/* Form Submission ID */}
            <div className="space-y-2">
              <Label htmlFor="formSubmissionId">
                Form Submission ID (Optional)
              </Label>
              <Input
                id="formSubmissionId"
                value={formSubmissionId}
                onChange={(e) => setFormSubmissionId(e.target.value)}
                placeholder="Enter form submission reference"
              />
              <p className="text-xs text-gray-500">
                Reference to any form submission related to this verification
              </p>
            </div>

            {/* Completion Notes */}
            <div className="space-y-2">
              <Label htmlFor="completionNotes">
                Completion Notes <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="completionNotes"
                value={completionNotes}
                onChange={(e) => {
                  setCompletionNotes(e.target.value);
                  clearError('completionNotes');
                }}
                placeholder="Provide detailed notes about the verification process and findings..."
                rows={4}
                className={errors.completionNotes ? 'border-red-500' : ''}
              />
              {errors.completionNotes && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.completionNotes}</span>
                </p>
              )}
              <p className="text-xs text-gray-500">
                Include any relevant details, observations, or issues encountered
              </p>
            </div>
          </div>

          {/* Completion Summary */}
          {verificationOutcome && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-900">
                    Completion Summary
                  </p>
                  <div className="text-sm text-green-800 space-y-1">
                    <p>
                      <span className="font-medium">Outcome:</span>{' '}
                      <Badge className={getOutcomeColor(verificationOutcome)}>
                        {outcomeOptions.find(opt => opt.value === verificationOutcome)?.label}
                      </Badge>
                    </p>
                    {actualAmount && (
                      <p>
                        <span className="font-medium">Amount:</span>{' '}
                        ₹{actualAmount.toLocaleString('en-IN')}
                      </p>
                    )}
                    {formSubmissionId && (
                      <p>
                        <span className="font-medium">Form Ref:</span>{' '}
                        {formSubmissionId}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !verificationOutcome}
            >
              {loading ? 'Completing...' : 'Complete Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
