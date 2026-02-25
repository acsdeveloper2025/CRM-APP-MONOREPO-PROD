import type { RequestHandler } from 'express';
import { validateCaseAccess, validateClientAccess } from '@/middleware/clientAccess';
import { validateCaseProductAccess, validateProductAccess } from '@/middleware/productAccess';
import { validateTaskRecordAccess } from '@/middleware/taskAuthorization';

export const validateCaseRecordAccess: RequestHandler[] = [
  validateCaseAccess as RequestHandler,
  validateCaseProductAccess as RequestHandler,
];

export const validateTaskOwnedOrScopedAccess = validateTaskRecordAccess as RequestHandler;
export const validateClientRecordAccess = validateClientAccess('params') as RequestHandler;
export const validateProductRecordAccess = validateProductAccess('params') as RequestHandler;
