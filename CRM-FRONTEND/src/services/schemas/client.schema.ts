// Zod schemas for client/product/attachment/dashboard endpoints.
// All permissive-with-.passthrough() to detect shape breaks without
// forcing an exhaustive field list.

import { z } from 'zod';

export const ClientSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    code: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const ProductSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    code: z.string().optional(),
    clientId: z.number().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

export const AttachmentSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    fileSize: z.number().optional(),
  })
  .passthrough();

export const DashboardSummarySchema = z
  .object({
    totalCases: z.number().optional(),
    pendingCases: z.number().optional(),
    completedCases: z.number().optional(),
    activeTasks: z.number().optional(),
  })
  .passthrough();

export type ClientDto = z.infer<typeof ClientSchema>;
export type ProductDto = z.infer<typeof ProductSchema>;
export type AttachmentDto = z.infer<typeof AttachmentSchema>;
export type DashboardSummaryDto = z.infer<typeof DashboardSummarySchema>;
