import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskValidationBadgeProps {
  taskId: string;
  taskStatus: string;
  className?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validationTimestamp?: string;
}

export function TaskValidationBadge({ taskId, taskStatus, className }: TaskValidationBadgeProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateTask = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/verification-tasks/${taskId}/validate`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setValidation(result.data);
      }
    } catch (error) {
      console.error('Failed to validate task:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    // Only validate COMPLETED tasks
    if (taskStatus === 'COMPLETED') {
      validateTask();
    }
  }, [taskStatus, validateTask]);

  // Don't show badge for non-completed tasks
  if (taskStatus !== 'COMPLETED') {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Badge variant="outline" className={cn('text-xs', className)}>
        <span className="animate-pulse">Validating...</span>
      </Badge>
    );
  }

  // No validation data yet
  if (!validation) {
    return null;
  }

  // Task is valid
  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="default" className={cn('text-xs bg-green-600 hover:bg-green-700', className)}>
              <CheckCircle className="w-3 h-3 mr-1" />
              Validated
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Task has all required data</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Task has warnings but is valid
  if (validation.isValid && validation.warnings.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn('text-xs border-yellow-500 text-yellow-600', className)}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              Warnings ({validation.warnings.length})
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-1">
              <p className="font-semibold text-sm">Warnings:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Task is invalid
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className={cn('text-xs cursor-help', className)}>
            <AlertCircle className="w-3 h-3 mr-1" />
            Invalid Data ({validation.errors.length})
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2">
            <p className="font-semibold text-sm text-red-400">Validation Errors:</p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
            {validation.warnings.length > 0 && (
              <>
                <p className="font-semibold text-sm text-yellow-400 mt-2">Warnings:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-xs text-gray-400 mt-2">
              This task is marked COMPLETED but is missing required data.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
