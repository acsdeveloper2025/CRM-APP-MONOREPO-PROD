import { Request, Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';

// Mock data for demonstration (replace with actual database operations)
let commissions: any[] = [
  {
    id: 'commission_1',
    userId: 'user_1',
    userName: 'John Doe',
    caseId: 'case_1',
    caseTitle: 'Residence Verification - John Doe',
    clientId: 'client_1',
    clientName: 'Acme Corporation',
    baseAmount: 500,
    commissionRate: 15, // 15%
    commissionAmount: 75,
    status: 'APPROVED',
    approvedBy: 'user_3',
    approvedAt: '2024-01-05T00:00:00.000Z',
    paidDate: '2024-01-10T00:00:00.000Z',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Commission for completed verification',
    createdAt: '2024-01-05T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
  },
  {
    id: 'commission_2',
    userId: 'user_2',
    userName: 'Jane Smith',
    caseId: 'case_2',
    caseTitle: 'Office Verification - Tech Solutions Inc',
    clientId: 'client_2',
    clientName: 'Tech Solutions Inc',
    baseAmount: 800,
    commissionRate: 12, // 12%
    commissionAmount: 96,
    status: 'PENDING',
    approvedBy: null,
    approvedAt: null,
    paidDate: null,
    paymentMethod: null,
    notes: 'Pending approval',
    createdAt: '2024-01-06T00:00:00.000Z',
    updatedAt: '2024-01-06T00:00:00.000Z',
  },
  {
    id: 'commission_3',
    userId: 'user_1',
    userName: 'John Doe',
    caseId: 'case_3',
    caseTitle: 'Residence Verification - Alice Johnson',
    clientId: 'client_1',
    clientName: 'Acme Corporation',
    baseAmount: 500,
    commissionRate: 15, // 15%
    commissionAmount: 75,
    status: 'APPROVED',
    approvedBy: 'user_3',
    approvedAt: '2024-01-07T00:00:00.000Z',
    paidDate: null,
    paymentMethod: null,
    notes: 'Approved but not yet paid',
    createdAt: '2024-01-07T00:00:00.000Z',
    updatedAt: '2024-01-07T00:00:00.000Z',
  },
];

// GET /api/commissions - List commissions with pagination and filters
export const getCommissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId, 
      status, 
      clientId, 
      dateFrom, 
      dateTo, 
      search, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    let filteredCommissions = [...commissions];

    // Apply filters
    if (userId) {
      filteredCommissions = filteredCommissions.filter(comm => comm.userId === userId);
    }
    if (status) {
      filteredCommissions = filteredCommissions.filter(comm => comm.status === status);
    }
    if (clientId) {
      filteredCommissions = filteredCommissions.filter(comm => comm.clientId === clientId);
    }
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredCommissions = filteredCommissions.filter(comm => 
        comm.userName.toLowerCase().includes(searchTerm) ||
        comm.caseTitle.toLowerCase().includes(searchTerm) ||
        comm.clientName.toLowerCase().includes(searchTerm)
      );
    }
    if (dateFrom) {
      filteredCommissions = filteredCommissions.filter(comm => new Date(comm.createdAt) >= new Date(dateFrom as string));
    }
    if (dateTo) {
      filteredCommissions = filteredCommissions.filter(comm => new Date(comm.createdAt) <= new Date(dateTo as string));
    }

    // Apply sorting
    filteredCommissions.sort((a, b) => {
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
    const paginatedCommissions = filteredCommissions.slice(startIndex, endIndex);

    logger.info(`Retrieved ${paginatedCommissions.length} commissions`, { 
      userId: req.user?.id,
      filters: { userId, status, clientId, search },
      pagination: { page, limit }
    });

    res.json({
      success: true,
      data: paginatedCommissions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredCommissions.length,
        totalPages: Math.ceil(filteredCommissions.length / (limit as number)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving commissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/commissions/:id - Get commission by ID
export const getCommissionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const commission = commissions.find(comm => comm.id === id);

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved commission ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: commission,
    });
  } catch (error) {
    logger.error('Error retrieving commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve commission',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/:id/approve - Approve commission
export const approveCommission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const commissionIndex = commissions.findIndex(comm => comm.id === id);
    if (commissionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (commissions[commissionIndex].status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Commission is already approved',
        error: { code: 'ALREADY_APPROVED' },
      });
    }

    // Update commission
    commissions[commissionIndex].status = 'APPROVED';
    commissions[commissionIndex].approvedBy = req.user?.id;
    commissions[commissionIndex].approvedAt = new Date().toISOString();
    if (notes) {
      commissions[commissionIndex].notes = notes;
    }
    commissions[commissionIndex].updatedAt = new Date().toISOString();

    logger.info(`Commission approved: ${id}`, { 
      userId: req.user?.id,
      commissionAmount: commissions[commissionIndex].commissionAmount
    });

    res.json({
      success: true,
      data: commissions[commissionIndex],
      message: 'Commission approved successfully',
    });
  } catch (error) {
    logger.error('Error approving commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve commission',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/:id/mark-paid - Mark commission as paid
export const markCommissionPaid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { paidDate, paymentMethod, transactionId, notes } = req.body;

    const commissionIndex = commissions.findIndex(comm => comm.id === id);
    if (commissionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    if (commissions[commissionIndex].status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Commission must be approved before marking as paid',
        error: { code: 'NOT_APPROVED' },
      });
    }

    if (commissions[commissionIndex].paidDate) {
      return res.status(400).json({
        success: false,
        message: 'Commission is already marked as paid',
        error: { code: 'ALREADY_PAID' },
      });
    }

    // Update commission
    commissions[commissionIndex].paidDate = paidDate || new Date().toISOString();
    commissions[commissionIndex].paymentMethod = paymentMethod;
    commissions[commissionIndex].transactionId = transactionId;
    if (notes) {
      commissions[commissionIndex].notes = `${commissions[commissionIndex].notes}\nPayment: ${notes}`;
    }
    commissions[commissionIndex].updatedAt = new Date().toISOString();

    logger.info(`Commission marked as paid: ${id}`, { 
      userId: req.user?.id,
      commissionAmount: commissions[commissionIndex].commissionAmount
    });

    res.json({
      success: true,
      data: commissions[commissionIndex],
      message: 'Commission marked as paid successfully',
    });
  } catch (error) {
    logger.error('Error marking commission as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark commission as paid',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/commissions/summary - Get commission summary
export const getCommissionSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, period = 'month' } = req.query;

    let filteredCommissions = [...commissions];
    if (userId) {
      filteredCommissions = filteredCommissions.filter(comm => comm.userId === userId);
    }

    const totalCommissions = filteredCommissions.length;
    const approvedCommissions = filteredCommissions.filter(comm => comm.status === 'APPROVED').length;
    const pendingCommissions = filteredCommissions.filter(comm => comm.status === 'PENDING').length;
    const paidCommissions = filteredCommissions.filter(comm => comm.paidDate).length;

    const totalAmount = filteredCommissions.reduce((sum, comm) => sum + comm.commissionAmount, 0);
    const approvedAmount = filteredCommissions
      .filter(comm => comm.status === 'APPROVED')
      .reduce((sum, comm) => sum + comm.commissionAmount, 0);
    const paidAmount = filteredCommissions
      .filter(comm => comm.paidDate)
      .reduce((sum, comm) => sum + comm.commissionAmount, 0);
    const pendingAmount = filteredCommissions
      .filter(comm => comm.status === 'PENDING')
      .reduce((sum, comm) => sum + comm.commissionAmount, 0);

    const userSummary = filteredCommissions.reduce((acc, comm) => {
      if (!acc[comm.userId]) {
        acc[comm.userId] = {
          userId: comm.userId,
          userName: comm.userName,
          totalCommissions: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
        };
      }
      acc[comm.userId].totalCommissions++;
      acc[comm.userId].totalAmount += comm.commissionAmount;
      if (comm.paidDate) {
        acc[comm.userId].paidAmount += comm.commissionAmount;
      } else if (comm.status === 'PENDING') {
        acc[comm.userId].pendingAmount += comm.commissionAmount;
      }
      return acc;
    }, {} as Record<string, any>);

    const summary = {
      totalCommissions,
      approvedCommissions,
      pendingCommissions,
      paidCommissions,
      totalAmount,
      approvedAmount,
      paidAmount,
      pendingAmount,
      userSummary: Object.values(userSummary),
      period,
      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Error getting commission summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get commission summary',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/bulk-approve - Bulk approve commissions
export const bulkApproveCommissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commissionIds, notes } = req.body;

    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission IDs array is required',
        error: { code: 'MISSING_COMMISSION_IDS' },
      });
    }

    const approvedCommissions = [];
    const errors = [];

    for (const id of commissionIds) {
      try {
        const commissionIndex = commissions.findIndex(comm => comm.id === id);
        if (commissionIndex === -1) {
          errors.push(`Commission ${id}: Not found`);
          continue;
        }

        if (commissions[commissionIndex].status === 'APPROVED') {
          errors.push(`Commission ${id}: Already approved`);
          continue;
        }

        // Update commission
        commissions[commissionIndex].status = 'APPROVED';
        commissions[commissionIndex].approvedBy = req.user?.id;
        commissions[commissionIndex].approvedAt = new Date().toISOString();
        if (notes) {
          commissions[commissionIndex].notes = notes;
        }
        commissions[commissionIndex].updatedAt = new Date().toISOString();

        approvedCommissions.push(id);
      } catch (error) {
        errors.push(`Commission ${id}: ${error}`);
      }
    }

    logger.info(`Bulk approved ${approvedCommissions.length} commissions`, {
      userId: req.user?.id,
      successCount: approvedCommissions.length,
      errorCount: errors.length
    });

    res.json({
      success: true,
      data: {
        approved: approvedCommissions,
        errors,
        summary: {
          total: commissionIds.length,
          successful: approvedCommissions.length,
          failed: errors.length,
        }
      },
      message: `Bulk approval completed: ${approvedCommissions.length} successful, ${errors.length} failed`,
    });
  } catch (error) {
    logger.error('Error in bulk approve:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve commissions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/commissions/bulk-mark-paid - Bulk mark commissions as paid
export const bulkMarkCommissionsPaid = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commissionIds, paymentMethod, transactionId, notes } = req.body;

    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission IDs array is required',
        error: { code: 'MISSING_COMMISSION_IDS' },
      });
    }

    const paidCommissions = [];
    const errors = [];

    for (const id of commissionIds) {
      try {
        const commissionIndex = commissions.findIndex(comm => comm.id === id);
        if (commissionIndex === -1) {
          errors.push(`Commission ${id}: Not found`);
          continue;
        }

        if (commissions[commissionIndex].status !== 'APPROVED') {
          errors.push(`Commission ${id}: Must be approved first`);
          continue;
        }

        if (commissions[commissionIndex].paidDate) {
          errors.push(`Commission ${id}: Already paid`);
          continue;
        }

        // Update commission
        commissions[commissionIndex].paidDate = new Date().toISOString();
        commissions[commissionIndex].paymentMethod = paymentMethod;
        commissions[commissionIndex].transactionId = transactionId;
        if (notes) {
          commissions[commissionIndex].notes = `${commissions[commissionIndex].notes}\nPayment: ${notes}`;
        }
        commissions[commissionIndex].updatedAt = new Date().toISOString();

        paidCommissions.push(id);
      } catch (error) {
        errors.push(`Commission ${id}: ${error}`);
      }
    }

    logger.info(`Bulk marked ${paidCommissions.length} commissions as paid`, {
      userId: req.user?.id,
      successCount: paidCommissions.length,
      errorCount: errors.length
    });

    res.json({
      success: true,
      data: {
        paid: paidCommissions,
        errors,
        summary: {
          total: commissionIds.length,
          successful: paidCommissions.length,
          failed: errors.length,
        }
      },
      message: `Bulk payment completed: ${paidCommissions.length} successful, ${errors.length} failed`,
    });
  } catch (error) {
    logger.error('Error in bulk mark paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk mark commissions as paid',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
