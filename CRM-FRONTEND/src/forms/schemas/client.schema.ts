import { z } from 'zod';

// Empty string is allowed (clears the color); otherwise #RGB or #RRGGBB.
const HEX_COLOR_REGEX = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

export const clientProductMappingSchema = z.object({
  productId: z.number(),
  verificationTypeIds: z.array(z.number()),
  documentTypeIds: z.array(z.number()),
});

const baseClientShape = {
  name: z.string().min(1, 'Client name is required').max(100, 'Name too long'),
  code: z
    .string()
    .min(2, 'Client code must be at least 2 characters')
    .max(10, 'Client code must be at most 10 characters')
    .regex(
      /^[A-Z0-9_]+$/,
      'Client code must contain only uppercase letters, numbers, and underscores'
    ),
  productMappings: z.array(clientProductMappingSchema).optional(),
};

export const createClientFormSchema = z.object(baseClientShape);
export type CreateClientFormData = z.infer<typeof createClientFormSchema>;

export const editClientFormSchema = z.object({
  ...baseClientShape,
  primaryColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Must be a hex color like #FF9800 or empty')
    .optional(),
  headerColor: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Must be a hex color like #FFEB3B or empty')
    .optional(),
});
export type EditClientFormData = z.infer<typeof editClientFormSchema>;

export const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Product code is required').max(50, 'Code too long'),
});
export type ProductFormData = z.infer<typeof productFormSchema>;

const baseVerificationTypeShape = {
  name: z.string().min(1, 'Verification type name is required').max(100, 'Name too long'),
  code: z.string().min(2, 'Code is required').max(50, 'Code too long'),
};

export const createVerificationTypeFormSchema = z.object({
  ...baseVerificationTypeShape,
  category: z.string().min(1, 'Category is required'),
});
export type CreateVerificationTypeFormData = z.infer<typeof createVerificationTypeFormSchema>;

export const editVerificationTypeFormSchema = z.object(baseVerificationTypeShape);
export type EditVerificationTypeFormData = z.infer<typeof editVerificationTypeFormSchema>;
