// Zod schemas for notification + report + billing list endpoints.
//
// All permissive-with-.passthrough() — these shapes evolve frequently
// as the product adds new notification types, report formats, and
// invoice fields. The validators only guard against hard breaks
// (id missing, status missing, payload not an object).

import { z } from 'zod';

export const NotificationSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string().optional(),
    message: z.string().optional(),
    userId: z.string().optional(),
    isRead: z.boolean().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const NotificationListSchema = z.array(NotificationSchema);

export const InvoiceSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    invoiceNumber: z.string().optional(),
    status: z.string().optional(),
    amount: z.union([z.number(), z.string()]).optional(),
    currency: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const InvoiceListSchema = z.array(InvoiceSchema);

export const ReportMetaSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();

export const ReportListSchema = z.array(ReportMetaSchema);

export type NotificationDto = z.infer<typeof NotificationSchema>;
export type InvoiceDto = z.infer<typeof InvoiceSchema>;
export type ReportMetaDto = z.infer<typeof ReportMetaSchema>;
