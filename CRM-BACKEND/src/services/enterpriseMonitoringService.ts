import { EventEmitter } from 'events';
import { pool } from '../config/database';
import { EnterpriseCacheService } from './enterpriseCacheService';
import { logger } from '../config/logger';
import os from 'os';
import process from 'process';

interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  database: {
    activeConnections: number;
    totalConnections: number;
    queryCount: number;
    averageQueryTime: number;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    keyCount: number;
  };
  api: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  };
  queue: {
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
  };
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

interface PerformanceReport {
  period: 'hour' | 'day' | 'week' | 'month';
  startTime: number;
  endTime: number;
  metrics: {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    uptime: number;
    peakConcurrentUsers: number;
    databasePerformance: {
      averageQueryTime: number;
      slowQueries: number;
      connectionPoolUtilization: number;
    };
    cachePerformance: {
      hitRate: number;
      missRate: number;
      evictionRate: number;
    };
  };
  recommendations: string[];
}

export class EnterpriseMonitoringService extends EventEmitter {
  private static instance: EnterpriseMonitoringService;
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private isMonitoring = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private maxMetricsHistory = 1440; // 24 hours of minute-by-minute data

  private constructor() {
    super();
    this.initializeDefaultAlertRules();
  }

  static getInstance(): EnterpriseMonitoringService {
    if (!EnterpriseMonitoringService.instance) {
      EnterpriseMonitoringService.instance = new EnterpriseMonitoringService();
    }
    return EnterpriseMonitoringService.instance;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('Enterprise monitoring service started');

    // Collect metrics every minute
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        this.metrics.push(metrics);

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetricsHistory) {
          this.metrics = this.metrics.slice(-this.maxMetricsHistory);
        }

        // Check alert rules
        await this.checkAlertRules(metrics);

        // Emit metrics event
        this.emit('metrics', metrics);

      } catch (error) {
        logger.error('Error collecting metrics:', error);
      }
    }, 60000); // Every minute
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    logger.info('Enterprise monitoring service stopped');
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const timestamp = Date.now();

    // CPU metrics
    const cpuUsage = await this.getCpuUsage();
    const loadAverage = os.loadavg();

    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Database metrics
    const databaseMetrics = await this.getDatabaseMetrics();

    // Cache metrics
    const cacheMetrics = await this.getCacheMetrics();

    // API metrics (would be collected from request interceptors)
    const apiMetrics = await this.getApiMetrics();

    // Queue metrics (would be collected from queue service)
    const queueMetrics = await this.getQueueMetrics();

    return {
      timestamp,
      cpu: {
        usage: cpuUsage,
        loadAverage,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: memoryPercentage,
      },
      database: databaseMetrics,
      cache: cacheMetrics,
      api: apiMetrics,
      queue: queueMetrics,
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = process.hrtime(startTime);

        const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;

        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      // Get connection pool stats
      const poolStats = (pool as any).totalCount || 0;
      const activeConnections = (pool as any).idleCount || 0;

      // Get query performance (simplified - would need proper query logging)
      const queryStats = await this.getQueryStats();

      return {
        activeConnections,
        totalConnections: poolStats,
        queryCount: queryStats.count,
        averageQueryTime: queryStats.averageTime,
      };
    } catch (error) {
      logger.error('Error getting database metrics:', error);
      return {
        activeConnections: 0,
        totalConnections: 0,
        queryCount: 0,
        averageQueryTime: 0,
      };
    }
  }

  private async getCacheMetrics(): Promise<SystemMetrics['cache']> {
    try {
      const cacheStats = await EnterpriseCacheService.getStats();
      
      return {
        hitRate: cacheStats.memory?.keyspace_hits || 0,
        memoryUsage: cacheStats.memory?.used_memory || 0,
        keyCount: cacheStats.keyspace?.db0?.keys || 0,
      };
    } catch (error) {
      logger.error('Error getting cache metrics:', error);
      return {
        hitRate: 0,
        memoryUsage: 0,
        keyCount: 0,
      };
    }
  }

  private async getApiMetrics(): Promise<SystemMetrics['api']> {
    // This would be populated by API middleware
    // For now, return mock data
    return {
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };
  }

  private async getQueueMetrics(): Promise<SystemMetrics['queue']> {
    // This would be populated by queue service
    // For now, return mock data
    return {
      pendingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
    };
  }

  private async getQueryStats(): Promise<{ count: number; averageTime: number }> {
    // This would require query logging implementation
    // For now, return mock data
    return {
      count: 0,
      averageTime: 0,
    };
  }

  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage',
        metric: 'cpu.usage',
        operator: '>',
        threshold: 80,
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack'],
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        metric: 'memory.percentage',
        operator: '>',
        threshold: 85,
        duration: 300,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack'],
      },
      {
        id: 'database-connection-limit',
        name: 'Database Connection Limit',
        metric: 'database.activeConnections',
        operator: '>',
        threshold: 90,
        duration: 60,
        severity: 'critical',
        enabled: true,
        notificationChannels: ['email', 'slack', 'pagerduty'],
      },
      {
        id: 'high-api-error-rate',
        name: 'High API Error Rate',
        metric: 'api.errorRate',
        operator: '>',
        threshold: 5,
        duration: 180,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email'],
      },
      {
        id: 'slow-api-response',
        name: 'Slow API Response Time',
        metric: 'api.averageResponseTime',
        operator: '>',
        threshold: 2000,
        duration: 300,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email'],
      },
    ];
  }

  private async checkAlertRules(metrics: SystemMetrics): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const value = this.getMetricValue(metrics, rule.metric);
      const isTriggered = this.evaluateCondition(value, rule.operator, rule.threshold);

      if (isTriggered) {
        await this.triggerAlert(rule, value);
      } else {
        await this.resolveAlert(rule.id);
      }
    }
  }

  private getMetricValue(metrics: SystemMetrics, metricPath: string): number {
    const parts = metricPath.split('.');
    let value: any = metrics;

    for (const part of parts) {
      value = value?.[part];
    }

    return typeof value === 'number' ? value : 0;
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '=': return value === threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    // Check if alert already exists and is not resolved
    const existingAlert = this.alerts.find(a => a.ruleId === rule.id && !a.resolved);
    if (existingAlert) return;

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.name}: ${value} ${rule.operator} ${rule.threshold}`,
      value,
      threshold: rule.threshold,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    logger.warn('Alert triggered:', alert);

    // Send notifications
    await this.sendNotifications(alert, rule.notificationChannels);
  }

  private async resolveAlert(ruleId: string): Promise<void> {
    const alert = this.alerts.find(a => a.ruleId === ruleId && !a.resolved);
    if (!alert) return;

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    this.emit('alertResolved', alert);
    logger.info('Alert resolved:', alert);
  }

  private async sendNotifications(alert: Alert, channels: string[]): Promise<void> {
    // Implementation would depend on notification services
    // For now, just log
    logger.info('Sending alert notifications:', { alert, channels });
  }

  // Public API methods
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getMetricsHistory(hours = 24): SystemMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(limit = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  async generatePerformanceReport(period: 'hour' | 'day' | 'week' | 'month'): Promise<PerformanceReport> {
    const now = Date.now();
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const startTime = now - periodMs[period];
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= startTime);

    if (relevantMetrics.length === 0) {
      throw new Error('No metrics available for the specified period');
    }

    // Calculate aggregated metrics
    const totalRequests = relevantMetrics.reduce((sum, m) => sum + m.api.requestCount, 0);
    const averageResponseTime = relevantMetrics.reduce((sum, m) => sum + m.api.averageResponseTime, 0) / relevantMetrics.length;
    const errorRate = relevantMetrics.reduce((sum, m) => sum + m.api.errorRate, 0) / relevantMetrics.length;
    const uptime = (relevantMetrics.length / (periodMs[period] / 60000)) * 100; // Percentage

    const report: PerformanceReport = {
      period,
      startTime,
      endTime: now,
      metrics: {
        averageResponseTime,
        totalRequests,
        errorRate,
        uptime,
        peakConcurrentUsers: Math.max(...relevantMetrics.map(m => m.database.activeConnections)),
        databasePerformance: {
          averageQueryTime: relevantMetrics.reduce((sum, m) => sum + m.database.averageQueryTime, 0) / relevantMetrics.length,
          slowQueries: 0, // Would need proper tracking
          connectionPoolUtilization: relevantMetrics.reduce((sum, m) => sum + (m.database.activeConnections / m.database.totalConnections), 0) / relevantMetrics.length * 100,
        },
        cachePerformance: {
          hitRate: relevantMetrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / relevantMetrics.length,
          missRate: 100 - (relevantMetrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / relevantMetrics.length),
          evictionRate: 0, // Would need proper tracking
        },
      },
      recommendations: this.generateRecommendations(relevantMetrics),
    };

    return report;
  }

  private generateRecommendations(metrics: SystemMetrics[]): string[] {
    const recommendations: string[] = [];
    
    const avgCpuUsage = metrics.reduce((sum, m) => sum + m.cpu.usage, 0) / metrics.length;
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memory.percentage, 0) / metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.api.averageResponseTime, 0) / metrics.length;

    if (avgCpuUsage > 70) {
      recommendations.push('Consider scaling horizontally or optimizing CPU-intensive operations');
    }

    if (avgMemoryUsage > 80) {
      recommendations.push('Memory usage is high - consider optimizing memory allocation or scaling vertically');
    }

    if (avgResponseTime > 1000) {
      recommendations.push('API response times are slow - consider implementing caching or optimizing database queries');
    }

    return recommendations;
  }

  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.alertRules.push({ ...rule, id });
    return id;
  }

  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const index = this.alertRules.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.alertRules[index] = { ...this.alertRules[index], ...updates };
    return true;
  }

  deleteAlertRule(id: string): boolean {
    const index = this.alertRules.findIndex(r => r.id === id);
    if (index === -1) return false;

    this.alertRules.splice(index, 1);
    return true;
  }

  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }
}

export default EnterpriseMonitoringService.getInstance();
