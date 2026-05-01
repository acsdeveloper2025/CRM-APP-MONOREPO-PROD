import { z } from 'zod';

export const documentTypeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must contain only uppercase letters, numbers, and underscores'),
});
export type DocumentTypeFormData = z.infer<typeof documentTypeFormSchema>;
