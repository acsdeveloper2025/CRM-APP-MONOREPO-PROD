// Invoice domain types — extracted from invoicesController (§7 decomposition).

export interface InvoiceItem {
  id: string;
  invoiceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  totalPrice?: number;
  caseIds: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  client?: {
    id: string;
    name: string;
    code: string;
    email?: string;
    phone?: string;
  };
  amount: number;
  subtotalAmount?: number;
  currency: string;
  status: string;
  dueDate: string;
  issueDate: string;
  paidDate: string | null;
  items: InvoiceItem[];
  taxAmount: number;
  totalAmount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod?: string;
  transactionId?: string;
  // GST breakdown (NULL for legacy pre-2026-05-12 invoices).
  supplyType?: 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT' | null;
  placeOfSupply?: string | null;
  cgstRate?: number | null;
  cgstAmount?: number | null;
  sgstRate?: number | null;
  sgstAmount?: number | null;
  igstRate?: number | null;
  igstAmount?: number | null;
}

export type InvoiceListRow = {
  id: number;
  invoiceNumber: string;
  clientId: number;
  productId: number | null;
  clientName: string;
  amount: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string | null;
  transactionId: string | null;
  clientCode: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  supplyType: string | null;
  placeOfSupply: string | null;
  cgstRate: string | null;
  cgstAmount: string | null;
  sgstRate: string | null;
  sgstAmount: string | null;
  igstRate: string | null;
  igstAmount: string | null;
};

export type InvoiceItemRow = {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  caseIds: string[] | null;
};

export type InvoiceTaskCandidateRow = {
  id: string;
  caseId: string;
  verificationTypeId: number | null;
  rateTypeId: number | null;
  actualAmount: string | null;
  estimatedAmount: string | null;
  areaId: number | null;
  taskTitle: string | null;
  taskType: 'NORMAL' | 'REVISIT' | 'KYC' | null;
  pincodeId: number | null;
  clientId: number;
  productId: number;
};

export type CreateInvoiceBody = {
  clientId?: string | number;
  clientName?: string;
  items?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    caseId?: string;
    caseIds?: string[];
  }>;
  dueDate?: string;
  notes?: string;
  currency?: string;
  taskIds?: string[];
  billingPeriodFrom?: string;
  billingPeriodTo?: string;
  productId?: string | number;
};

export type InvoiceKycTaskCandidateRow = {
  id: string; // verification_task_id (kept for linkedTasks.taskId)
  caseId: string;
  taskTitle: string | null;
  estimatedAmount: string | null;
  actualAmount: string | null;
  documentTypeId: number | null;
  documentTypeName: string | null;
  documentTypeCode: string | null;
  clientId: number;
  productId: number;
  // P4 (2026-06-02): billing is now per reverification CYCLE, not per task.
  cycleId: string;
  cycleNumber: number;
  rateAmount: string | null;
};
