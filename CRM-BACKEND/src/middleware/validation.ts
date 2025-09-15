import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse, ValidationError } from '@/types/api';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors: ValidationError[] = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    // Log validation errors for debugging
    console.log('Validation errors:', {
      url: req.url,
      method: req.method,
      body: req.body,
      errors: validationErrors
    });

    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: validationErrors,
      },
    };

    res.status(400).json(response);
    return;
  }

  next();
};

// Overloaded validate function to support both patterns:
// 1. validate (simple middleware)
// 2. validate(validationArray) (function that returns middleware)
export function validate(req: Request, res: Response, next: NextFunction): void;
export function validate(validations: ValidationChain[]): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export function validate(
  reqOrValidations: Request | ValidationChain[],
  res?: Response,
  next?: NextFunction
): void | ((req: Request, res: Response, next: NextFunction) => Promise<void>) {
  // Pattern 1: validate(req, res, next) - simple middleware
  if (res && next) {
    handleValidationErrors(reqOrValidations as Request, res, next);
    return;
  }

  // Pattern 2: validate(validations) - returns middleware function
  const validations = reqOrValidations as ValidationChain[];
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    handleValidationErrors(req, res, next);
  };
}
