import { apiService } from './api';

export interface MobileTaskRecord {
  id: string;
  verificationTaskId?: string;
  caseId?: string | number;
  customerName?: string;
  verificationType?: string;
  verificationTypeDetails?: { name?: string };
  status?: string;
  assignedAt?: string;
  completedAt?: string;
  inProgressAt?: string;
  updatedAt?: string;
  addressStreet?: string;
  attachmentCount?: number;
  notes?: string;
}

interface MobileTasksApiResponse {
  success?: boolean;
  data?: {
    tasks?: MobileTaskRecord[];
    cases?: MobileTaskRecord[];
  };
}

export interface AgentDashboardStats {
  todaySubmissions: number;
  weekSubmissions: number;
  monthSubmissions: number;
  qualityScore: number;
  completionRate: number;
  avgResponseTime: number;
  pendingTasks: number;
  completedTasks: number;
}

export interface PerformanceReportData {
  qualityScore: number;
  completionRate: number;
  avgResponseTime: number;
  submissions: number;
  trends: Array<{ date: string; score: number; submissions: number }>;
  breakdown: Array<{ metric: string; value: number }>;
}

export interface SubmissionReportData {
  total: number;
  recent: Array<{
    id: string;
    customer: string;
    type: string;
    status: string;
    date: string;
  }>;
  byType: Array<{ type: string; count: number; percentage: number }>;
  byStatus: Array<{ status: string; count: number; percentage: number }>;
}

export interface AnalyticsReportData {
  overview: {
    totalForms: number;
    validationRate: number;
    avgQuality: number;
    totalTime: number;
  };
  daily: Array<{ date: string; submissions: number; quality: number }>;
  hourly: Array<{ hour: string; count: number }>;
}

export interface PerformanceMetricsData {
  daily: Array<{
    date: string;
    submissions: number;
    quality: number;
    completionTime: number;
  }>;
  weekly: Array<{
    week: string;
    submissions: number;
    quality: number;
    completionRate: number;
  }>;
  monthly: Array<{
    month: string;
    submissions: number;
    quality: number;
    completionRate: number;
  }>;
  formTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  radarData: Array<{
    metric: string;
    value: number;
    fullMark: 100;
  }>;
}

const COMPLETED_STATUSES = new Set(['COMPLETED', 'VALID']);
const ACTIVE_STATUSES = new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REQUIRES_REVIEW', 'ON_HOLD']);

const toDate = (value?: string): Date | null => {
  if (!value) {return null;}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const statusOf = (task: MobileTaskRecord): string =>
  String(task.status || 'PENDING')
    .trim()
    .toUpperCase();

const completionDurationMinutes = (task: MobileTaskRecord): number | null => {
  const start = toDate(task.inProgressAt || task.assignedAt);
  const end = toDate(task.completedAt || task.updatedAt);
  if (!start || !end) {return null;}
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  return diff > 0 ? diff : null;
};

const isWithinDays = (date: Date | null, days: number): boolean => {
  if (!date) {return false;}
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - days);
  return date >= from && date <= now;
};

const readTasks = (payload: MobileTasksApiResponse | null | undefined): MobileTaskRecord[] => {
  const tasks = payload?.data?.tasks || payload?.data?.cases;
  return Array.isArray(tasks) ? tasks : [];
};

const percentage = (num: number, den: number): number => (den <= 0 ? 0 : Math.round((num / den) * 100));

const groupBy = <T,>(items: T[], keyFn: (item: T) => string): Record<string, T[]> => {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {acc[key] = [];}
    acc[key].push(item);
    return acc;
  }, {});
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const calculateQualityScore = (tasks: MobileTaskRecord[]): number => {
  if (tasks.length === 0) {return 0;}
  const completed = tasks.filter(task => COMPLETED_STATUSES.has(statusOf(task))).length;
  const withAttachments = tasks.filter(task => Number(task.attachmentCount || 0) > 0).length;
  const completionComponent = percentage(completed, tasks.length);
  const evidenceComponent = percentage(withAttachments, tasks.length);
  return Math.round(completionComponent * 0.7 + evidenceComponent * 0.3);
};

export class MobileReportsService {
  static async fetchMobileTasks(limit = 500): Promise<MobileTaskRecord[]> {
    const response = await apiService.get<MobileTasksApiResponse>(
      '/mobile/tasks',
      {
        page: 1,
        limit,
      },
      {
        headers: {
          'X-App-Version': '4.0.1',
          'X-Platform': 'WEB',
        },
      }
    );
    return readTasks(response);
  }

  static buildAgentDashboardStats(tasks: MobileTaskRecord[]): AgentDashboardStats {
    const completedTasks = tasks.filter(task => COMPLETED_STATUSES.has(statusOf(task)));
    const pendingTasks = tasks.filter(task => ACTIVE_STATUSES.has(statusOf(task)));

    const todayCount = completedTasks.filter(task => {
      const completedAt = toDate(task.completedAt || task.updatedAt);
      return isWithinDays(completedAt, 1);
    }).length;
    const weekCount = completedTasks.filter(task => {
      const completedAt = toDate(task.completedAt || task.updatedAt);
      return isWithinDays(completedAt, 7);
    }).length;
    const monthCount = completedTasks.filter(task => {
      const completedAt = toDate(task.completedAt || task.updatedAt);
      return isWithinDays(completedAt, 30);
    }).length;

    const durations = completedTasks
      .map(task => completionDurationMinutes(task))
      .filter((value): value is number => typeof value === 'number');
    const avgResponseTime =
      durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;

    const completionRate = percentage(completedTasks.length, tasks.length);
    const qualityScore = calculateQualityScore(tasks);

    return {
      todaySubmissions: todayCount,
      weekSubmissions: weekCount,
      monthSubmissions: monthCount,
      qualityScore,
      completionRate,
      avgResponseTime,
      pendingTasks: pendingTasks.length,
      completedTasks: completedTasks.length,
    };
  }

  static buildPerformanceReport(tasks: MobileTaskRecord[]): PerformanceReportData {
    const now = new Date();
    const trendDays = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - index));
      return day;
    });

    const dailyGroups = groupBy(tasks, task => {
      const date = toDate(task.completedAt || task.updatedAt || task.assignedAt);
      return date ? formatDate(date) : '';
    });

    const trends = trendDays.map(day => {
      const key = formatDate(day);
      const dayTasks = dailyGroups[key] || [];
      const completed = dayTasks.filter(task => COMPLETED_STATUSES.has(statusOf(task))).length;
      return {
        date: key,
        score: calculateQualityScore(dayTasks),
        submissions: completed,
      };
    });

    const stats = this.buildAgentDashboardStats(tasks);
    return {
      qualityScore: stats.qualityScore,
      completionRate: stats.completionRate,
      avgResponseTime: stats.avgResponseTime,
      submissions: stats.completedTasks,
      trends,
      breakdown: [
        { metric: 'Completion', value: stats.completionRate },
        { metric: 'Quality', value: stats.qualityScore },
        { metric: 'Evidence', value: percentage(tasks.filter(task => Number(task.attachmentCount || 0) > 0).length, tasks.length) },
        { metric: 'Task Coverage', value: percentage(stats.completedTasks + stats.pendingTasks, tasks.length || 1) },
      ],
    };
  }

  static buildSubmissionsReport(tasks: MobileTaskRecord[]): SubmissionReportData {
    const byTypeGroups = groupBy(tasks, task => {
      const type = task.verificationTypeDetails?.name || task.verificationType || 'UNKNOWN';
      return String(type).toUpperCase();
    });

    const byStatusGroups = groupBy(tasks, task => statusOf(task));

    const byType = Object.entries(byTypeGroups).map(([type, items]) => ({
      type,
      count: items.length,
      percentage: percentage(items.length, tasks.length),
    }));

    const byStatus = Object.entries(byStatusGroups).map(([status, items]) => ({
      status,
      count: items.length,
      percentage: percentage(items.length, tasks.length),
    }));

    const recent = [...tasks]
      .sort((a, b) => {
        const dateA = toDate(a.completedAt || a.updatedAt || a.assignedAt)?.getTime() || 0;
        const dateB = toDate(b.completedAt || b.updatedAt || b.assignedAt)?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 10)
      .map(task => ({
        id: task.verificationTaskId || task.id,
        customer: task.customerName || 'Unknown',
        type: (task.verificationTypeDetails?.name || task.verificationType || 'UNKNOWN').toString(),
        status: statusOf(task),
        date:
          toDate(task.completedAt || task.updatedAt || task.assignedAt)?.toISOString().split('T')[0] ||
          new Date().toISOString().split('T')[0],
      }));

    return {
      total: tasks.length,
      recent,
      byType,
      byStatus,
    };
  }

  static buildAnalyticsReport(tasks: MobileTaskRecord[]): AnalyticsReportData {
    const performance = this.buildPerformanceReport(tasks);
    const submissions = this.buildSubmissionsReport(tasks);
    const stats = this.buildAgentDashboardStats(tasks);

    const daily = performance.trends.map(item => ({
      date: item.date,
      submissions: item.submissions,
      quality: item.score,
    }));

    const hourlyGroups = groupBy(tasks, task => {
      const date = toDate(task.completedAt || task.updatedAt || task.assignedAt);
      return date ? `${date.getHours().toString().padStart(2, '0')}:00` : '00:00';
    });

    const hourly = Object.entries(hourlyGroups)
      .map(([hour, items]) => ({ hour, count: items.length }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      overview: {
        totalForms: submissions.total,
        validationRate: stats.completionRate,
        avgQuality: stats.qualityScore,
        totalTime: stats.avgResponseTime * stats.completedTasks,
      },
      daily,
      hourly,
    };
  }

  static async getAgentDashboardStats(): Promise<AgentDashboardStats> {
    const tasks = await this.fetchMobileTasks();
    return this.buildAgentDashboardStats(tasks);
  }

  static async getPerformanceReportData(): Promise<PerformanceReportData> {
    const tasks = await this.fetchMobileTasks();
    return this.buildPerformanceReport(tasks);
  }

  static async getSubmissionsReportData(): Promise<SubmissionReportData> {
    const tasks = await this.fetchMobileTasks();
    return this.buildSubmissionsReport(tasks);
  }

  static async getAnalyticsReportData(): Promise<AnalyticsReportData> {
    const tasks = await this.fetchMobileTasks();
    return this.buildAnalyticsReport(tasks);
  }

  static async getPerformanceMetricsData(): Promise<PerformanceMetricsData> {
    const tasks = await this.fetchMobileTasks();
    const now = new Date();
    const performance = this.buildPerformanceReport(tasks);
    const submissions = this.buildSubmissionsReport(tasks);
    const stats = this.buildAgentDashboardStats(tasks);

    const daily = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const key = formatDate(date);
      const dayTasks = tasks.filter(task => formatDate(toDate(task.completedAt || task.updatedAt || task.assignedAt) || new Date(0)) === key);
      const completionTimes = dayTasks
        .map(task => completionDurationMinutes(task))
        .filter((value): value is number => typeof value === 'number');

      return {
        date: key,
        submissions: dayTasks.filter(task => COMPLETED_STATUSES.has(statusOf(task))).length,
        quality: calculateQualityScore(dayTasks),
        completionTime:
          completionTimes.length > 0
            ? Math.round(completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length)
            : 0,
      };
    });

    const weekly = Array.from({ length: 4 }).map((_, index) => {
      const daysBackFrom = (3 - index) * 7 + 6;
      const daysBackTo = (3 - index) * 7;
      const from = new Date(now);
      const to = new Date(now);
      from.setDate(now.getDate() - daysBackFrom);
      to.setDate(now.getDate() - daysBackTo);
      const weekTasks = tasks.filter(task => {
        const date = toDate(task.completedAt || task.updatedAt || task.assignedAt);
        return !!date && date >= from && date <= to;
      });
      const completed = weekTasks.filter(task => COMPLETED_STATUSES.has(statusOf(task))).length;
      return {
        week: `Week ${index + 1}`,
        submissions: completed,
        quality: calculateQualityScore(weekTasks),
        completionRate: percentage(completed, weekTasks.length),
      };
    });

    const monthly = Array.from({ length: 4 }).map((_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (3 - index), 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - (2 - index), 1);
      const monthTasks = tasks.filter(task => {
        const date = toDate(task.completedAt || task.updatedAt || task.assignedAt);
        return !!date && date >= monthDate && date < nextMonthDate;
      });
      const completed = monthTasks.filter(task => COMPLETED_STATUSES.has(statusOf(task))).length;
      return {
        month: monthDate.toLocaleString('default', { month: 'short' }),
        submissions: completed,
        quality: calculateQualityScore(monthTasks),
        completionRate: percentage(completed, monthTasks.length),
      };
    });

    return {
      daily,
      weekly,
      monthly,
      formTypes: submissions.byType,
      radarData: [
        { metric: 'Quality', value: stats.qualityScore, fullMark: 100 },
        { metric: 'Completion', value: stats.completionRate, fullMark: 100 },
        { metric: 'Evidence', value: percentage(tasks.filter(task => Number(task.attachmentCount || 0) > 0).length, tasks.length), fullMark: 100 },
        { metric: 'Punctuality', value: Math.max(0, 100 - Math.min(stats.avgResponseTime, 100)), fullMark: 100 },
        { metric: 'Throughput', value: Math.min(100, performance.submissions), fullMark: 100 },
      ],
    };
  }
}
