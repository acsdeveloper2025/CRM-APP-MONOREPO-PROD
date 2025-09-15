import { Request, Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';

// Mock data for demonstration (replace with actual database operations)
let invoices: any[] = [
  {
    id: 'invoice_1',
    invoiceNumber: 'INV-2024-001',
    clientId: 'client_1',
    clientName: 'Acme Corporation',
    amount: 15000,
    currency: 'INR',
    status: 'PAID',
    dueDate: '2024-02-01T00:00:00.000Z',
    issueDate: '2024-01-01T00:00:00.000Z',
    paidDate: '2024-01-25T00:00:00.000Z',
    items: [
      {
        id: 'item_1',
        description: 'Residence Verification Services',
        quantity: 10,
        unitPrice: 500,
        amount: 5000,
        caseIds: ['case_1', 'case_3'],
      },
      {
        id: 'item_2',
        description: 'Employment Verification Services',
        quantity: 20,
        unitPrice: 400,
        amount: 8000,
        caseIds: ['case_2'],
      },
      {
        id: 'item_3',
        description: 'Service Charges',
        quantity: 1,
        unitPrice: 2000,
        amount: 2000,
        caseIds: [],
      },
    ],
    taxAmount: 2700, // 18% GST
    totalAmount: 17700,
    notes: 'Payment received on time',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-25T00:00:00.000Z',
  },
  {
    id: 'invoice_2',
    invoiceNumber: 'INV-2024-002',
    clientId: 'client_2',
    clientName: 'Tech Solutions Inc',
    amount: 8000,
    currency: 'INR',
    status: 'PENDING',
    dueDate: '2024-02-15T00:00:00.000Z',
    issueDate: '2024-01-15T00:00:00.000Z',
    paidDate: null,
    items: [
      {
        id: 'item_4',
        description: 'Office Verification Services',
        quantity: 8,
        unitPrice: 500,
        amount: 4000,
        caseIds: ['case_4'],
      },
      {
        id: 'item_5',
        description: 'Business Verification Services',
        quantity: 5,
        unitPrice: 800,
        amount: 4000,
        caseIds: ['case_5'],
      },
    ],
    taxAmount: 1440, // 18% GST
    totalAmount: 9440,
    notes: 'Payment pending',
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
];

// GET /api/invoices - List invoices with pagination and filters
export const getInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      clientId, 
      status, 
      dateFrom, 
      dateTo, 
      search, 
      sortBy = 'issueDate', 
      sortOrder = 'desc' 
    } = req.query;

    let filteredInvoices = [...invoices];

    // Apply filters
    if (clientId) {
      filteredInvoices = filteredInvoices.filter(inv => inv.clientId === clientId);
    }
    if (status) {
      filteredInvoices = filteredInvoices.filter(inv => inv.status === status);
    }
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(searchTerm) ||
        inv.clientName.toLowerCase().includes(searchTerm) ||
        inv.notes.toLowerCase().includes(searchTerm)
      );
    }
    if (dateFrom) {
      filteredInvoices = filteredInvoices.filter(inv => new Date(inv.issueDate) >= new Date(dateFrom as string));
    }
    if (dateTo) {
      filteredInvoices = filteredInvoices.filter(inv => new Date(inv.issueDate) <= new Date(dateTo as string));
    }

    // Apply sorting
    filteredInvoices.sort((a, b) => {
      const aValue = a[sortBy as string];
      const bValue = b[sortBy as string];
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Apply pagination
    const startIndex = ((page as number) - 1) * (limit as number);
    const endIndex = startIndex + (limit as number);
    const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

    logger.info(`Retrieved ${paginatedInvoices.length} invoices`, { 
      userId: req.user?.id,
      filters: { clientId, status, search },
      pagination: { page, limit }
    });

    res.json({
      success: true,
      data: paginatedInvoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredInvoices.length,
        totalPages: Math.ceil(filteredInvoices.length / (limit as number)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoices',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/invoices/:id - Get invoice by ID
export const getInvoiceById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = invoices.find(inv => inv.id === id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved invoice ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    logger.error('Error retrieving invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoice',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/invoices - Create new invoice
export const createInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      clientId, 
      clientName, 
      items, 
      dueDate, 
      notes, 
      currency = 'INR' 
    } = req.body;

    // Calculate amounts
    const amount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const taxRate = 0.18; // 18% GST
    const taxAmount = Math.round(amount * taxRate);
    const totalAmount = amount + taxAmount;

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;

    const newInvoice = {
      id: `invoice_${Date.now()}`,
      invoiceNumber,
      clientId,
      clientName,
      amount,
      currency,
      status: 'PENDING',
      dueDate,
      issueDate: new Date().toISOString(),
      paidDate: null,
      items: items.map((item: any, index: number) => ({
        id: `item_${Date.now()}_${index}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
        caseIds: item.caseIds || [],
      })),
      taxAmount,
      totalAmount,
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    invoices.push(newInvoice);

    logger.info(`Created new invoice: ${newInvoice.id}`, { 
      userId: req.user?.id,
      invoiceNumber,
      clientId,
      amount: totalAmount
    });

    res.status(201).json({
      success: true,
      data: newInvoice,
      message: 'Invoice created successfully',
    });
  } catch (error) {
    logger.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// PUT /api/invoices/:id - Update invoice
export const updateInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const invoiceIndex = invoices.findIndex(inv => inv.id === id);
    if (invoiceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Prevent updating paid invoices
    if (invoices[invoiceIndex].status === 'PAID' && updateData.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify paid invoice',
        error: { code: 'INVOICE_PAID' },
      });
    }

    // Recalculate amounts if items are updated
    if (updateData.items) {
      const amount = updateData.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
      const taxRate = 0.18;
      const taxAmount = Math.round(amount * taxRate);
      const totalAmount = amount + taxAmount;
      
      updateData.amount = amount;
      updateData.taxAmount = taxAmount;
      updateData.totalAmount = totalAmount;
    }

    // Update invoice
    const updatedInvoice = {
      ...invoices[invoiceIndex],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    invoices[invoiceIndex] = updatedInvoice;

    logger.info(`Updated invoice: ${id}`, { 
      userId: req.user?.id,
      changes: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: updatedInvoice,
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    logger.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/invoices/:id - Delete invoice
export const deleteInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const invoiceIndex = invoices.findIndex(inv => inv.id === id);
    if (invoiceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Prevent deleting paid invoices
    if (invoices[invoiceIndex].status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoice',
        error: { code: 'INVOICE_PAID' },
      });
    }

    const deletedInvoice = invoices[invoiceIndex];
    invoices.splice(invoiceIndex, 1);

    logger.info(`Deleted invoice: ${id}`, { 
      userId: req.user?.id,
      invoiceNumber: deletedInvoice.invoiceNumber
    });

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/invoices/:id/send - Send invoice
export const sendInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, message } = req.body;

    const invoiceIndex = invoices.findIndex(inv => inv.id === id);
    if (invoiceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // Update invoice status to SENT if it was DRAFT
    if (invoices[invoiceIndex].status === 'DRAFT') {
      invoices[invoiceIndex].status = 'SENT';
      invoices[invoiceIndex].updatedAt = new Date().toISOString();
    }

    // In a real implementation, this would send an email
    logger.info(`Invoice sent: ${id}`, {
      userId: req.user?.id,
      email,
      invoiceNumber: invoices[invoiceIndex].invoiceNumber
    });

    res.json({
      success: true,
      data: invoices[invoiceIndex],
      message: 'Invoice sent successfully',
    });
  } catch (error) {
    logger.error('Error sending invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/invoices/:id/mark-paid - Mark invoice as paid
export const markInvoicePaid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { paidDate, paymentMethod, transactionId, notes } = req.body;

    const invoiceIndex = invoices.findIndex(inv => inv.id === id);
    if (invoiceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (invoices[invoiceIndex].status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already marked as paid',
        error: { code: 'ALREADY_PAID' },
      });
    }

    // Update invoice
    invoices[invoiceIndex].status = 'PAID';
    invoices[invoiceIndex].paidDate = paidDate || new Date().toISOString();
    invoices[invoiceIndex].paymentMethod = paymentMethod;
    invoices[invoiceIndex].transactionId = transactionId;
    if (notes) {
      invoices[invoiceIndex].notes = `${invoices[invoiceIndex].notes}\nPayment: ${notes}`;
    }
    invoices[invoiceIndex].updatedAt = new Date().toISOString();

    logger.info(`Invoice marked as paid: ${id}`, {
      userId: req.user?.id,
      invoiceNumber: invoices[invoiceIndex].invoiceNumber,
      amount: invoices[invoiceIndex].totalAmount
    });

    res.json({
      success: true,
      data: invoices[invoiceIndex],
      message: 'Invoice marked as paid successfully',
    });
  } catch (error) {
    logger.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as paid',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/invoices/:id/download - Download invoice PDF
export const downloadInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = invoices.find(inv => inv.id === id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    // In a real implementation, this would generate and return a PDF
    const downloadUrl = `/api/invoices/${id}/pdf/${invoice.invoiceNumber}.pdf`;

    logger.info(`Invoice download requested: ${id}`, {
      userId: req.user?.id,
      invoiceNumber: invoice.invoiceNumber
    });

    res.json({
      success: true,
      data: {
        downloadUrl,
        filename: `${invoice.invoiceNumber}.pdf`,
        invoiceNumber: invoice.invoiceNumber,
        generatedAt: new Date().toISOString(),
      },
      message: 'Invoice download link generated',
    });
  } catch (error) {
    logger.error('Error generating invoice download:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice download',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/invoices/stats - Get invoice statistics
export const getInvoiceStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = 'month' } = req.query;

    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length;
    const pendingInvoices = invoices.filter(inv => inv.status === 'PENDING').length;
    const overdueInvoices = invoices.filter(inv =>
      inv.status === 'PENDING' && new Date(inv.dueDate) < new Date()
    ).length;

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const paidAmount = invoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const pendingAmount = invoices
      .filter(inv => inv.status === 'PENDING')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const statusDistribution = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const clientDistribution = invoices.reduce((acc, inv) => {
      acc[inv.clientName] = (acc[inv.clientName] || 0) + inv.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      totalAmount,
      paidAmount,
      pendingAmount,
      collectionRate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
      statusDistribution,
      clientDistribution,
      period,
      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
