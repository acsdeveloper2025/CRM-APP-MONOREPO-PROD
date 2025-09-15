import { Request, Response } from 'express';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/middleware/auth';

// Mock data for demonstration (replace with actual database operations)
let auditLogs: any[] = [
  {
    id: 'audit_1',
    userId: 'user_1',
    userName: 'John Doe',
    action: 'CASE_CREATED',
    resource: 'cases',
    resourceId: 'case_1',
    details: {
      title: 'Residence Verification - John Doe',
      clientId: 'client_1',
      assignedToId: 'user_1',
    },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timestamp: '2024-01-01T10:00:00.000Z',
    severity: 'INFO',
    category: 'CASE_MANAGEMENT',
  },
  {
    id: 'audit_2',
    userId: 'user_3',
    userName: 'Admin User',
    action: 'USER_LOGIN',
    resource: 'auth',
    resourceId: 'user_3',
    details: {
      loginMethod: 'email',
      success: true,
    },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    timestamp: '2024-01-01T09:30:00.000Z',
    severity: 'INFO',
    category: 'AUTHENTICATION',
  },
  {
    id: 'audit_3',
    userId: 'user_2',
    userName: 'Jane Smith',
    action: 'CASE_STATUS_UPDATED',
    resource: 'cases',
    resourceId: 'case_2',
    details: {
      oldStatus: 'PENDING',
      newStatus: 'IN_PROGRESS',
      caseTitle: 'Office Verification - Tech Solutions Inc',
    },
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
    timestamp: '2024-01-01T11:15:00.000Z',
    severity: 'INFO',
    category: 'CASE_MANAGEMENT',
  },
  {
    id: 'audit_4',
    userId: 'user_3',
    userName: 'Admin User',
    action: 'USER_CREATED',
    resource: 'users',
    resourceId: 'user_4',
    details: {
      newUserName: 'New Field Agent',
      role: 'FIELD',
      email: 'newagent@example.com',
    },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    timestamp: '2024-01-01T14:20:00.000Z',
    severity: 'WARN',
    category: 'USER_MANAGEMENT',
  },
  {
    id: 'audit_5',
    userId: 'user_1',
    userName: 'John Doe',
    action: 'FILE_UPLOADED',
    resource: 'attachments',
    resourceId: 'attachment_1',
    details: {
      fileName: 'residence_photo.jpg',
      fileSize: 1024000,
      caseId: 'case_1',
    },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timestamp: '2024-01-01T15:45:00.000Z',
    severity: 'INFO',
    category: 'FILE_MANAGEMENT',
  },
];

// GET /api/audit-logs - List audit logs with pagination and filters
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId, 
      action, 
      resource, 
      category, 
      severity, 
      dateFrom, 
      dateTo, 
      search, 
      sortBy = 'timestamp', 
      sortOrder = 'desc' 
    } = req.query;

    let filteredLogs = [...auditLogs];

    // Apply filters
    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === userId);
    }
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }
    if (resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === resource);
    }
    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }
    if (severity) {
      filteredLogs = filteredLogs.filter(log => log.severity === severity);
    }
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.userName.toLowerCase().includes(searchTerm) ||
        log.action.toLowerCase().includes(searchTerm) ||
        log.resource.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm)
      );
    }
    if (dateFrom) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(dateFrom as string));
    }
    if (dateTo) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= new Date(dateTo as string));
    }

    // Apply sorting
    filteredLogs.sort((a, b) => {
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
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    logger.info(`Retrieved ${paginatedLogs.length} audit logs`, { 
      userId: req.user?.id,
      filters: { userId, action, resource, category, search },
      pagination: { page, limit }
    });

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredLogs.length,
        totalPages: Math.ceil(filteredLogs.length / (limit as number)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/:id - Get audit log by ID
export const getAuditLogById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const auditLog = auditLogs.find(log => log.id === id);

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found',
        error: { code: 'NOT_FOUND' },
      });
    }

    logger.info(`Retrieved audit log ${id}`, { userId: req.user?.id });

    res.json({
      success: true,
      data: auditLog,
    });
  } catch (error) {
    logger.error('Error retrieving audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit log',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/mobile/audit/logs - Create mobile audit log batch
export const createMobileAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logs, batchId, deviceId } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid logs format. Expected array of logs.'
      });
    }

    console.log(`📝 Processing ${logs.length} mobile audit logs (batch: ${batchId})`);

    // Process each log in the batch
    const processedLogs = logs.map(log => ({
      id: log.id || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: req.user?.id || log.userId,
      userName: req.user?.username || log.username || 'Mobile User',
      action: log.action || 'MOBILE_ACTION',
      resource: log.entityType || 'mobile',
      resourceId: log.entityId || 'unknown',
      details: {
        ...log.details,
        deviceInfo: log.deviceInfo,
        location: log.location,
        timestamp: log.timestamp,
        batchId,
        deviceId
      },
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Mobile App',
      timestamp: log.timestamp || new Date().toISOString(),
      severity: 'INFO',
      category: 'CASE_MANAGEMENT'
    }));

    // Add to mock storage (replace with actual database operations)
    auditLogs.push(...processedLogs);

    console.log(`✅ Successfully processed ${processedLogs.length} mobile audit logs`);

    res.status(201).json({
      success: true,
      message: `Successfully processed ${processedLogs.length} audit logs`,
      batchId,
      processed: processedLogs.length
    });
  } catch (error) {
    console.error('Error creating mobile audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create mobile audit logs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// POST /api/audit-logs - Create audit log entry
export const createAuditLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      action,
      resource,
      resourceId,
      details,
      severity = 'INFO',
      category
    } = req.body;

    const newAuditLog = {
      id: `audit_${Date.now()}`,
      userId: req.user?.id,
      userName: req.user?.username || 'Unknown User',
      action,
      resource,
      resourceId,
      details: details || {},
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString(),
      severity,
      category,
    };

    auditLogs.push(newAuditLog);

    logger.info(`Created audit log: ${newAuditLog.id}`, { 
      userId: req.user?.id,
      action,
      resource,
      resourceId
    });

    res.status(201).json({
      success: true,
      data: newAuditLog,
      message: 'Audit log created successfully',
    });
  } catch (error) {
    logger.error('Error creating audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create audit log',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/actions - Get available actions
export const getAuditActions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actions = [
      // Authentication actions
      'USER_LOGIN',
      'USER_LOGOUT',
      'LOGIN_FAILED',
      'PASSWORD_CHANGED',
      'PASSWORD_RESET',
      
      // User management actions
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      'ROLE_CHANGED',
      
      // Case management actions
      'CASE_CREATED',
      'CASE_UPDATED',
      'CASE_DELETED',
      'CASE_STATUS_UPDATED',
      'CASE_ASSIGNED',
      'CASE_COMPLETED',
      'CASE_APPROVED',
      'CASE_REJECTED',
      
      // Client management actions
      'CLIENT_CREATED',
      'CLIENT_UPDATED',
      'CLIENT_DELETED',
      'CLIENT_ACTIVATED',
      'CLIENT_DEACTIVATED',
      
      // File management actions
      'FILE_UPLOADED',
      'FILE_DOWNLOADED',
      'FILE_DELETED',
      'FILE_SHARED',
      
      // Financial actions
      'INVOICE_CREATED',
      'INVOICE_SENT',
      'INVOICE_PAID',
      'COMMISSION_APPROVED',
      'COMMISSION_PAID',
      
      // System actions
      'SETTINGS_UPDATED',
      'BACKUP_CREATED',
      'SYSTEM_MAINTENANCE',
      'DATA_EXPORT',
      'DATA_IMPORT',
    ];

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    logger.error('Error getting audit actions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit actions',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/categories - Get available categories
export const getAuditCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = [
      'AUTHENTICATION',
      'USER_MANAGEMENT',
      'CASE_MANAGEMENT',
      'CLIENT_MANAGEMENT',
      'FILE_MANAGEMENT',
      'FINANCIAL',
      'SYSTEM',
      'SECURITY',
      'DATA_MANAGEMENT',
      'REPORTING',
    ];

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.error('Error getting audit categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit categories',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// GET /api/audit-logs/stats - Get audit log statistics
export const getAuditStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = 'week' } = req.query;

    const totalLogs = auditLogs.length;

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    const periodLogs = auditLogs.filter(log => new Date(log.timestamp) >= startDate);

    // Action distribution
    const actionDistribution = auditLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Category distribution
    const categoryDistribution = auditLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Severity distribution
    const severityDistribution = auditLogs.reduce((acc, log) => {
      acc[log.severity] = (acc[log.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // User activity
    const userActivity = auditLogs.reduce((acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = {
          userId: log.userId,
          userName: log.userName,
          totalActions: 0,
          lastActivity: log.timestamp,
        };
      }
      acc[log.userId].totalActions++;
      if (new Date(log.timestamp) > new Date(acc[log.userId].lastActivity)) {
        acc[log.userId].lastActivity = log.timestamp;
      }
      return acc;
    }, {} as Record<string, any>);

    // Daily activity for the period
    const dailyActivity = periodLogs.reduce((acc, log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalLogs,
      periodLogs: periodLogs.length,
      period,
      actionDistribution,
      categoryDistribution,
      severityDistribution,
      topUsers: Object.values(userActivity)
        .sort((a: any, b: any) => b.totalActions - a.totalActions)
        .slice(0, 10),
      dailyActivity,
      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting audit stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit statistics',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// POST /api/audit-logs/export - Export audit logs
export const exportAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      format = 'CSV',
      dateFrom,
      dateTo,
      filters = {}
    } = req.body;

    let filteredLogs = [...auditLogs];

    // Apply date filters
    if (dateFrom) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= new Date(dateTo));
    }

    // Apply additional filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        filteredLogs = filteredLogs.filter(log => log[key] === value);
      }
    });

    // Create audit log for export action
    const exportAuditLog = {
      id: `audit_${Date.now()}`,
      userId: req.user?.id,
      userName: req.user?.username || 'Unknown User',
      action: 'DATA_EXPORT',
      resource: 'audit-logs',
      resourceId: null,
      details: {
        format,
        recordCount: filteredLogs.length,
        dateFrom,
        dateTo,
        filters,
      },
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      category: 'DATA_MANAGEMENT',
    };

    auditLogs.push(exportAuditLog);

    // In a real implementation, this would generate and return the actual file
    const exportData = {
      downloadUrl: `/api/audit-logs/download/${Date.now()}.${format.toLowerCase()}`,
      filename: `auditLogs_${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`,
      recordCount: filteredLogs.length,
      format,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    logger.info('Audit logs export requested', {
      userId: req.user?.id,
      format,
      recordCount: filteredLogs.length
    });

    res.json({
      success: true,
      data: exportData,
      message: 'Export file generated successfully',
    });
  } catch (error) {
    logger.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};

// DELETE /api/audit-logs/cleanup - Cleanup old audit logs
export const cleanupAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { olderThanDays = 90 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(olderThanDays));

    const initialCount = auditLogs.length;
    auditLogs = auditLogs.filter(log => new Date(log.timestamp) >= cutoffDate);
    const deletedCount = initialCount - auditLogs.length;

    // Create audit log for cleanup action
    const cleanupAuditLog = {
      id: `audit_${Date.now()}`,
      userId: req.user?.id,
      userName: req.user?.username || 'Unknown User',
      action: 'SYSTEM_MAINTENANCE',
      resource: 'audit-logs',
      resourceId: null,
      details: {
        operation: 'cleanup',
        olderThanDays: Number(olderThanDays),
        deletedCount,
        remainingCount: auditLogs.length,
      },
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString(),
      severity: 'WARN',
      category: 'SYSTEM',
    };

    auditLogs.push(cleanupAuditLog);

    logger.info('Audit logs cleanup completed', {
      userId: req.user?.id,
      deletedCount,
      remainingCount: auditLogs.length
    });

    res.json({
      success: true,
      data: {
        deletedCount,
        remainingCount: auditLogs.length,
        cutoffDate: cutoffDate.toISOString(),
      },
      message: `Cleanup completed: ${deletedCount} logs deleted`,
    });
  } catch (error) {
    logger.error('Error cleaning up audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup audit logs',
      error: { code: 'INTERNAL_ERROR' },
    });
  }
};
