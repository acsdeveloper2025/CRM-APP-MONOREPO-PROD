/**
 * Form-related Type Definitions
 * Types for form handling, validation, and submission
 */

/**
 * Form field value types
 */
export type FormFieldValue = string | number | boolean | Date | null | undefined | string[] | File | File[];

/**
 * Form values generic type
 */
export type FormValues = Record<string, FormFieldValue>;

/**
 * Form errors type
 */
export type FormErrors = Record<string, string | string[]>;

/**
 * Form field configuration
 */
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'file';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ label: string; value: string | number }>;
  validation?: FormFieldValidation;
}

/**
 * Form field validation rules
 */
export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: FormFieldValue) => string | null;
}

/**
 * Form submission result
 */
export interface FormSubmissionResult {
  success: boolean;
  message?: string;
  errors?: FormErrors;
  data?: unknown;
}

/**
 * Form state
 */
export interface FormState<T = FormValues> {
  values: T;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

/**
 * Form handlers
 */
export interface FormHandlers<T = FormValues> {
  handleChange: (name: keyof T, value: FormFieldValue) => void;
  handleBlur: (name: keyof T) => void;
  handleSubmit: (e?: React.FormEvent) => void | Promise<void>;
  handleReset: () => void;
  setFieldValue: (name: keyof T, value: FormFieldValue) => void;
  setFieldError: (name: keyof T, error: string) => void;
}

/**
 * File upload state
 */
export interface FileUploadState {
  file: File | null;
  preview?: string;
  progress: number;
  error?: string;
  isUploading: boolean;
}
