import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import type { Case } from '@/types/case';

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  case: Case | null;
  onApprove: (caseId: string, feedback?: string) => Promise<void>;
  onReject: (caseId: string, reason: string) => Promise<void>;
  onRequestRework: (caseId: string, feedback: string) => Promise<void>;
  isLoading?: boolean;
}

type ReviewAction = 'approve' | 'reject' | 'rework';

const reviewSchema = z.object({
  feedback: z.string().optional(),
  reason: z.string().optional(),
}).refine(() => {
  // If rejecting or requesting rework, reason/feedback is required
  return true; // We'll handle validation in the component
}, {
  message: "Feedback is required for rejection or rework requests"
});

type ReviewFormData = z.infer<typeof reviewSchema>;

export const ReviewDialog: React.FC<ReviewDialogProps> = ({
  isOpen,
  onClose,
  case: caseItem,
  onApprove,
  onReject,
  onRequestRework,
  isLoading,
}) => {
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
  });

  const feedback = watch('feedback');
  const reason = watch('reason');

  const handleClose = () => {
    setAction(null);
    reset();
    onClose();
  };

  const onSubmit = async (data: ReviewFormData) => {
    if (!caseItem || !action) return;

    setIsSubmitting(true);
    try {
      switch (action) {
        case 'approve':
          await onApprove(caseItem.id, data.feedback);
          break;
        case 'reject':
          if (!data.reason?.trim()) {
            alert('Reason is required for rejection');
            return;
          }
          await onReject(caseItem.id, data.reason);
          break;
        case 'rework':
          if (!data.feedback?.trim()) {
            alert('Feedback is required for rework requests');
            return;
          }
          await onRequestRework(caseItem.id, data.feedback);
          break;
      }
      handleClose();
    } catch (error) {
      console.error('Review action failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!caseItem) return null;

  const getActionColor = (actionType: ReviewAction) => {
    switch (actionType) {
      case 'approve':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'reject':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'rework':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const getActionIcon = (actionType: ReviewAction) => {
    switch (actionType) {
      case 'approve':
        return <CheckCircle className="h-4 w-4" />;
      case 'reject':
        return <XCircle className="h-4 w-4" />;
      case 'rework':
        return <RotateCcw className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Case #{caseItem.id.slice(-8)}</DialogTitle>
          <DialogDescription>
            Review the completed case and provide your decision
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Case Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-foreground mb-2">Case Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <span className="ml-2 font-medium">{caseItem.customerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client:</span>
                <span className="ml-2 font-medium">{caseItem.client?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium">{caseItem.verificationType || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned To:</span>
                <span className="ml-2 font-medium">{caseItem.assignedTo?.name}</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-muted-foreground">Description:</span>
              <p className="mt-1 text-sm">{caseItem.description}</p>
            </div>
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Choose Action</h4>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="justify-start h-auto p-4 text-left"
                  onClick={() => setAction('approve')}
                >
                  <CheckCircle className="h-5 w-5 mr-3 text-green-600" />
                  <div>
                    <div className="font-medium">Approve Case</div>
                    <div className="text-sm text-muted-foreground">
                      Mark this case as approved and complete
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto p-4 text-left"
                  onClick={() => setAction('rework')}
                >
                  <RotateCcw className="h-5 w-5 mr-3 text-yellow-600" />
                  <div>
                    <div className="font-medium">Request Rework</div>
                    <div className="text-sm text-muted-foreground">
                      Send back for additional work or corrections
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto p-4 text-left"
                  onClick={() => setAction('reject')}
                >
                  <XCircle className="h-5 w-5 mr-3 text-red-600" />
                  <div>
                    <div className="font-medium">Reject Case</div>
                    <div className="text-sm text-muted-foreground">
                      Reject this case submission
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Action Form */}
          {action && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center space-x-2">
                <Badge className={`border ${getActionColor(action)}`}>
                  {getActionIcon(action)}
                  <span className="ml-1 capitalize">{action}</span>
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAction(null)}
                >
                  Change
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={action === 'reject' ? 'reason' : 'feedback'}>
                  {action === 'reject' ? 'Rejection Reason *' : 
                   action === 'rework' ? 'Rework Feedback *' : 
                   'Approval Comments (Optional)'}
                </Label>
                <Textarea
                  id={action === 'reject' ? 'reason' : 'feedback'}
                  placeholder={
                    action === 'reject' ? 'Please provide a reason for rejection...' :
                    action === 'rework' ? 'Please provide specific feedback for rework...' :
                    'Add any additional comments...'
                  }
                  {...register(action === 'reject' ? 'reason' : 'feedback')}
                  className={errors.reason || errors.feedback ? 'border-red-500' : ''}
                />
                {(errors.reason || errors.feedback) && (
                  <p className="text-sm text-red-500">
                    {errors.reason?.message || errors.feedback?.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || 
                    isLoading || 
                    (action === 'reject' && !reason?.trim()) ||
                    (action === 'rework' && !feedback?.trim())
                  }
                  className={
                    action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                    action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-yellow-600 hover:bg-yellow-700'
                  }
                >
                  {isSubmitting ? 'Processing...' : `${action.charAt(0).toUpperCase() + action.slice(1)} Case`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
