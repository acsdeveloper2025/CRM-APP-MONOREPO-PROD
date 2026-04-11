// Zod schemas for case endpoints.
//
// Kept minimal — only the stable identity/status fields are required,
// everything else is accepted via .passthrough(). The goal is to catch
// shape breaks (id missing, status missing, payload not an object) not
// to mirror the TypeScript `Case` interface field-for-field, which
// evolves with every CRM feature.

import { z } from 'zod';
import { PaginationSchema } from './common.schema';

export const CaseSchema = z
  .object({
    id: z.string().min(1),
    status: z.string(),
    priority: z.string().optional(),
    clientId: z.number().optional(),
    productId: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export const CaseStatisticsSchema = z
  .object({
    totalCases: z.number().optional(),
    pending: z.number().optional(),
    inProgress: z.number().optional(),
    completed: z.number().optional(),
  })
  .passthrough();

export const CaseListResponseSchema = z
  .object({
    data: z.array(CaseSchema),
    statistics: CaseStatisticsSchema.optional(),
    pagination: PaginationSchema.optional(),
  })
  .passthrough();

export type CaseDto = z.infer<typeof CaseSchema>;
export type CaseListResponseDto = z.infer<typeof CaseListResponseSchema>;
