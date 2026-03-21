import React from 'react';
import { CaseStatusChart } from '@/components/dashboard/CaseStatusChart';
import { MonthlyTrendsChart } from '@/components/dashboard/MonthlyTrendsChart';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { useDashboardKPI } from '@/hooks/useDashboardKPI';
import {
  Users,
  XCircle,
  CheckSquare,
  Plus,
  CheckCircle,
  FileText,
  Download,
  AlertTriangle,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/ui/components/Badge';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Grid } from '@/ui/layout/Grid';
import { Page } from '@/ui/layout/Page';
import { Section } from '@/ui/layout/Section';
import { Box } from '@/ui/primitives/Box';
import { Stack } from '@/ui/primitives/Stack';
import { Text } from '@/ui/primitives/Text';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Fetch dashboard data via Unified KPI Engine
  const { 
    stats: kpiStats, 
    tatStats: tatStatsRaw, 
    caseDistributionData: distData, 
    trendsData: trData, 
    activitiesData: actData,
    cardTrends,
    isLoading 
  } = useDashboardKPI();

  // Adapters for legacy JSX compatibility
  const statsData = { data: kpiStats };
  const tatStatsData = { data: tatStatsRaw };
  const caseDistributionData = { data: distData };
  const trendsData = { data: trData };
  const activitiesData = { data: actData };

  const activitiesLoading = isLoading;
  const distributionLoading = isLoading;
  const trendsLoading = isLoading;

  const formatTrendLabel = (trend?: { value: number; isPositive: boolean }) => {
    if (!trend) {return null;}
    return `${trend.isPositive ? '+' : '-'}${trend.value}% vs previous period`;
  };

  // Mock data fallback for development


  const stats = statsData?.data || {
    totalCases: 0,
    pendingCases: 0,
    inProgressCases: 0,
    completedCases: 0,
    revokedTasks: 0,
    rejectedCases: 0,
    activeUsers: 0,
    totalClients: 0,
    pendingReviewCases: 0,
    monthlyRevenue: 0,
    totalInvoices: 0,
    pendingCommissions: 0,
    completionRate: 0,
    avgTurnaroundDays: 0
  };

    const tatStats = tatStatsData?.data || {
    criticalOverdue: 0,
    totalOverdue: 0,
    totalActiveTasks: 0,
    overduePercentage: 0
  };

  // Mock data removed - using real API data only


  // Fallback data for charts when API data is not available
  const mockCaseDistribution = [
    { status: 'PENDING', count: 0, percentage: 0 },
    { status: 'IN_PROGRESS', count: 0, percentage: 0 },
    { status: 'COMPLETED', count: 0, percentage: 0 },
    { status: 'PENDING_REVIEW', count: 0, percentage: 0 }
  ];

  const mockTrends = [
    { month: 'Jan', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Feb', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Mar', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Apr', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'May', totalCases: 0, revenue: 0, completionRate: 0 },
    { month: 'Jun', totalCases: 0, revenue: 0, completionRate: 0 }
  ];

  // Activities handled by kpiStats or actData

  const quickActions = [
    {
      title: 'Create New Case',
      description: 'Assign new case to field user',
      href: '/cases/new',
      icon: Plus,
      count: null,
    },
    {
      title: 'Completed Cases',
      description: 'View finished verifications',
      href: '/cases/completed',
      icon: CheckCircle,
      count: stats.completedCases,
    },
    {
      title: 'Pending Reviews',
      description: 'Cases waiting for approval',
      href: '/tasks/pending',
      icon: CheckSquare,
      count: stats.pendingReviewCases,
    },
    {
      title: 'All Cases',
      description: 'View all case statuses',
      href: '/cases',
      icon: FileText,
      count: stats.totalCases,
    },
  ];

  const metricCards = [
    {
      title: 'Total Cases',
      value: stats.totalCases,
      description: 'Active book of work',
      icon: FileText,
      tone: 'accent' as const,
      onClick: () => navigate('/cases'),
    },
    {
      title: 'TAT Overdue',
      value: tatStats.criticalOverdue,
      description: `${tatStats.totalOverdue} total overdue`,
      icon: AlertTriangle,
      tone: 'danger' as const,
      onClick: () => navigate('/tasks/tat-monitoring'),
    },
    {
      title: 'Revoked Tasks',
      value: stats.revokedTasks || 0,
      description: 'Returned by field teams',
      icon: XCircle,
      tone: 'warning' as const,
      onClick: () => navigate('/tasks/revoked'),
    },
    {
      title: 'In Progress',
      value: stats.inProgressCases,
      description: 'Currently underway',
      icon: CheckSquare,
      tone: 'neutral' as const,
      onClick: () => navigate('/tasks/in-progress'),
    },
    {
      title: 'Completed',
      value: stats.completedCases,
      description: 'Delivered successfully',
      icon: CheckCircle,
      tone: 'positive' as const,
      onClick: () => navigate('/tasks/completed'),
    },
    {
      title: 'Total Clients',
      value: stats.totalClients || 0,
      description: 'Accounts under management',
      icon: Users,
      tone: 'accent' as const,
      onClick: () => navigate('/clients'),
    },
  ];

  return (
    <Page
      className="ui-dashboard"
      title="Dashboard"
      subtitle="A high-clarity view of case volume, turnaround pressure, and operational momentum."
      shell
      actions={<Button variant="secondary" icon={<Download size={16} />}>Export report</Button>}
    >
      <Section className="ui-stagger">
        <Grid min={320} style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.85fr)' }}>
          <Card tone="highlight" className="ui-kpi-dominant">
            <Stack gap={5} style={{ height: '100%', justifyContent: 'space-between' }}>
              <Stack gap={3}>
                <Badge variant="accent">Executive Overview</Badge>
                <Text as="h2" variant="display">Move faster with a calmer control surface.</Text>
                <Text variant="body" tone="muted">
                  Track portfolio health, isolate pressure points, and jump directly into the queues that need intervention.
                </Text>
              </Stack>

              <Grid min={180} style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(160px, 0.8fr)' }}>
                <Stack gap={2}>
                  <Text variant="label" tone="soft">Dominant KPI</Text>
                  <Text variant="display">{stats.totalCases}</Text>
                  <Text variant="body-sm" tone="muted">Total active cases under management</Text>
                  <Stack direction="horizontal" gap={2} align="center">
                    <Badge variant="status-progress">Live portfolio</Badge>
                    {cardTrends?.totalCases ? (
                      <Text
                        variant="caption"
                        tone={cardTrends.totalCases.isPositive ? 'positive' : 'warning'}
                      >
                        {formatTrendLabel(cardTrends.totalCases)}
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>

                <Card tone="strong">
                  <Stack gap={2}>
                    <Badge variant="status-pending">Pressure Point</Badge>
                    <Text variant="headline">{tatStats.criticalOverdue}</Text>
                    <Text variant="body-sm" tone="muted">Critical overdue tasks requiring intervention</Text>
                    <Button variant="primary" icon={<ArrowUpRight size={16} />} onClick={() => navigate('/tasks/tat-monitoring')}>
                      Open TAT queue
                    </Button>
                  </Stack>
                </Card>
              </Grid>
            </Stack>
          </Card>

          <Card tone="strong" className="ui-hero-panel">
            <Stack gap={4} style={{ height: '100%', justifyContent: 'space-between' }}>
              <Stack gap={3}>
                <Badge variant="info">System Signal</Badge>
                <Text as="h3" variant="headline">Operations pulse</Text>
                <Text variant="body-sm" tone="muted">
                  A fast reading of execution quality, throughput, and client coverage.
                </Text>
              </Stack>
              <Stack gap={3}>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Completed today bias</Text>
                  <Text variant="title" tone="positive">{stats.completedCases}</Text>
                </Stack>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Pending reviews</Text>
                  <Text variant="title" tone="warning">{stats.pendingReviewCases}</Text>
                </Stack>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Client footprint</Text>
                  <Text variant="title" tone="accent">{stats.totalClients || 0}</Text>
                </Stack>
              </Stack>
              <Button variant="secondary" icon={<Sparkles size={16} />} onClick={() => navigate('/tasks/pending')}>
                Review pending approvals
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Section>

      <Section>
        <Grid min={210}>
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.title} className="ui-stat-card" onClick={metric.onClick} role="button">
                <Stack gap={3}>
                  <Stack direction="horizontal" align="center" justify="space-between" gap={3}>
                    <Badge variant={metric.tone}>{metric.title}</Badge>
                    <Icon size={18} />
                  </Stack>
                  <Stack gap={1}>
                    <Text variant="headline">{metric.value}</Text>
                    <Text variant="body-sm" tone="muted">{metric.description}</Text>
                    {cardTrends && metric.title === 'Total Cases' && cardTrends.totalCases ? (
                      <Text
                        variant="caption"
                        tone={cardTrends.totalCases.isPositive ? 'positive' : 'warning'}
                      >
                        {formatTrendLabel(cardTrends.totalCases)}
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Grid>
      </Section>

      <Section>
        <Grid min={300} style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)' }}>
          <Card tone="strong" staticCard>
            <Stack gap={4}>
              <Stack gap={1}>
                <Text as="h3" variant="headline">Recent activity</Text>
                <Text variant="body-sm" tone="muted">Latest execution signals, completions, and workflow events.</Text>
              </Stack>
              <RecentActivities
                activities={activitiesData?.data || []}
                isLoading={activitiesLoading}
              />
            </Stack>
          </Card>

          <Card tone="strong">
            <Stack gap={4}>
              <Stack gap={1}>
                <Text as="h3" variant="headline">Work focus</Text>
                <Text variant="body-sm" tone="muted">Direct jumps into the operational queues that matter most.</Text>
              </Stack>
              <Stack gap={3}>
                {quickActions.map((action) => (
                  <Link key={action.href} to={action.href} style={{ textDecoration: 'none' }}>
                    <Card tone="muted">
                      <Stack direction="horizontal" align="center" justify="space-between" gap={3}>
                        <Stack gap={1}>
                          <Badge variant="accent">
                            <action.icon size={14} />
                            {action.title}
                          </Badge>
                          <Text variant="body-sm" tone="muted">{action.description}</Text>
                        </Stack>
                        {action.count !== null ? <Text variant="headline">{action.count}</Text> : <ArrowUpRight size={18} />}
                      </Stack>
                    </Card>
                  </Link>
                ))}
              </Stack>
            </Stack>
          </Card>
        </Grid>
      </Section>

      <Section>
        <Grid min={420}>
          <Card tone="strong" staticCard>
            <CaseStatusChart
              data={caseDistributionData?.data || mockCaseDistribution}
              isLoading={distributionLoading}
            />
          </Card>
          <Card tone="strong" staticCard>
            <MonthlyTrendsChart
              data={trendsData?.data || mockTrends}
              isLoading={trendsLoading}
            />
          </Card>
        </Grid>
      </Section>

      <Section>
        <Grid min={300} style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.95fr)' }}>
          <Box>
            <Card tone="strong">
              <Stack gap={3}>
                <Text as="h3" variant="title">Financial overview</Text>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Monthly Revenue</Text>
                  <Text variant="title" tone="accent">${stats.monthlyRevenue?.toLocaleString() || '0'}</Text>
                </Stack>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Total Invoices</Text>
                  <Text variant="title">{stats.totalInvoices || 0}</Text>
                </Stack>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Pending Commissions</Text>
                  <Text variant="title" tone="warning">{stats.pendingCommissions || 0}</Text>
                </Stack>
              </Stack>
            </Card>
          </Box>

          <Card tone="strong">
              <Stack gap={3}>
                <Text as="h3" variant="title">Performance</Text>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Avg. Completion Time</Text>
                  <Text variant="title">{stats.avgTurnaroundDays ? `${stats.avgTurnaroundDays.toFixed(1)} days` : 'N/A'}</Text>
                </Stack>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Success Rate</Text>
                  <Text variant="title" tone="positive">{stats.completionRate ? `${stats.completionRate.toFixed(1)}%` : 'N/A'}</Text>
                </Stack>
                <Stack direction="horizontal" justify="space-between" align="center" gap={3}>
                  <Text variant="body-sm" tone="muted">Operations Health</Text>
                  <Text variant="title" tone="positive">Stable</Text>
                </Stack>
              </Stack>
          </Card>
        </Grid>
      </Section>
    </Page>
  );
};
