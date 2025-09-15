export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  subtotalAmount?: number;
  taxPercentage?: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    code: string;
    email?: string;
    phone?: string;
  };
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  totalPrice?: number;
  caseId?: string;
  case?: {
    id: string;
    title: string;
    customerName: string;
  };
}

export interface Commission {
  id: string;
  userId: string;
  caseId: string;
  clientId: string;
  productId: string;
  verificationTypeId: string;
  amount: number;
  percentage: number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  calculatedAt: string;
  paidAt?: string;
  user: {
    id: string;
    name: string;
    employeeId: string;
  };
  case: {
    id: string;
    title: string;
    customerName: string;
  };
  client: {
    id: string;
    name: string;
    code: string;
  };
}

export interface CommissionSummary {
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  totalCases: number;
  period: string;
}

export interface CreateInvoiceData {
  clientId: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    caseId?: string;
  }[];
  dueDate: string;
}

export interface InvoiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CommissionQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface UpdateInvoiceData {
  status?: string;
  paidDate?: string;
}
