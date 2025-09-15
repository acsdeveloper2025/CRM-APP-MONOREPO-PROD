import type { Role } from '@/types/auth';
import {
  LayoutDashboard,
  FileText,
  Building2,
  MapPin,
  Receipt,
  BarChart3,
  UserCog,
  Users,
  CheckSquare,
  Settings,
  Wifi,
  Shield,
  Plus,
  CheckCircle,
  Clock,
  DollarSign,
  PlayCircle
} from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: any;
  roles?: Role[]; // Made optional for backward compatibility
  permission?: {
    resource: string;
    action: string;
  };
  children?: NavigationItem[];
}

export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: { resource: 'cases', action: 'read' }, // Using cases permission for dashboard access
  },
  {
    id: 'cases',
    label: 'Case Management',
    href: '/cases',
    icon: FileText,
    permission: { resource: 'cases', action: 'read' },
    children: [
      {
        id: 'cases-list',
        label: 'All Cases',
        href: '/cases',
        icon: FileText,
        permission: { resource: 'cases', action: 'read' },
      },
      {
        id: 'cases-new',
        label: 'Create New Case',
        href: '/cases/new',
        icon: Plus,
        permission: { resource: 'cases', action: 'create' },
      },
      {
        id: 'cases-in-progress',
        label: 'In Progress Cases',
        href: '/cases/in-progress',
        icon: PlayCircle,
        permission: { resource: 'cases', action: 'read' },
      },
      {
        id: 'cases-completed',
        label: 'Completed Cases',
        href: '/cases/completed',
        icon: CheckCircle,
        permission: { resource: 'cases', action: 'read' },
      },
      {
        id: 'cases-pending',
        label: 'Pending Cases',
        href: '/cases/pending',
        icon: Clock,
        permission: { resource: 'cases', action: 'read' },
      },
    ],
  },
  {
    id: 'clients',
    label: 'Client Management',
    href: '/clients',
    icon: Building2,
    permission: { resource: 'clients', action: 'read' },
    children: [
      {
        id: 'clients-list',
        label: 'Clients',
        href: '/clients',
        icon: Building2,
        permission: { resource: 'clients', action: 'read' },
      },
      {
        id: 'products',
        label: 'Products',
        href: '/products',
        icon: Settings,
        permission: { resource: 'clients', action: 'read' },
      },
      {
        id: 'verification-types',
        label: 'Verification Types',
        href: '/verification-types',
        icon: CheckSquare,
        permission: { resource: 'clients', action: 'read' },
      },
      {
        id: 'rate-management',
        label: 'Rate Management',
        href: '/rate-management',
        icon: DollarSign,
        permission: { resource: 'clients', action: 'read' },
      },
    ],
  },
  {
    id: 'locations',
    label: 'Location Management',
    href: '/locations',
    icon: MapPin,
    permission: { resource: 'locations', action: 'read' },
    children: [
      {
        id: 'countries',
        label: 'Countries',
        href: '/locations?tab=countries',
        icon: MapPin,
        permission: { resource: 'locations', action: 'read' },
      },
      {
        id: 'states',
        label: 'States',
        href: '/locations?tab=states',
        icon: MapPin,
        permission: { resource: 'locations', action: 'read' },
      },
      {
        id: 'cities',
        label: 'Cities',
        href: '/locations?tab=cities',
        icon: MapPin,
        permission: { resource: 'locations', action: 'read' },
      },
      {
        id: 'pincodes',
        label: 'Pincodes',
        href: '/locations?tab=pincodes',
        icon: MapPin,
        permission: { resource: 'locations', action: 'read' },
      },
      {
        id: 'areas',
        label: 'Areas',
        href: '/locations?tab=areas',
        icon: MapPin,
        permission: { resource: 'locations', action: 'read' },
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & Commission',
    href: '/billing',
    icon: Receipt,
    permission: { resource: 'reports', action: 'read' }, // Using reports permission for billing
    children: [
      {
        id: 'invoices',
        label: 'Invoices',
        href: '/invoices',
        icon: Receipt,
        permission: { resource: 'reports', action: 'read' },
      },
      {
        id: 'commissions',
        label: 'Commissions',
        href: '/commissions',
        icon: BarChart3,
        permission: { resource: 'reports', action: 'read' },
      },
      {
        id: 'commission-management',
        label: 'Commission Management',
        href: '/commission-management',
        icon: DollarSign,
        permission: { resource: 'reports', action: 'read' },
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & MIS',
    href: '/reports',
    icon: BarChart3,
    permission: { resource: 'reports', action: 'read' },
    children: [
      {
        id: 'analytics',
        label: 'Analytics Dashboard',
        href: '/analytics',
        icon: BarChart3,
        permission: { resource: 'reports', action: 'read' },
      },
      {
        id: 'bank-bills',
        label: 'Bank Bills',
        href: '/reports/bank-bills',
        icon: Receipt,
        permission: { resource: 'reports', action: 'read' },
      },
      {
        id: 'mis-dashboard',
        label: 'MIS Dashboard',
        href: '/reports/mis',
        icon: BarChart3,
        permission: { resource: 'reports', action: 'read' },
      },
    ],
  },
  {
    id: 'user-management',
    label: 'User Management',
    href: '#',
    icon: UserCog,
    permission: { resource: 'users', action: 'read' },
    children: [
      {
        id: 'users',
        label: 'Users',
        href: '/users',
        icon: Users,
        permission: { resource: 'users', action: 'read' },
      },
      {
        id: 'role-management',
        label: 'Roles & Departments',
        href: '/role-management',
        icon: Shield,
        permission: { resource: 'roles', action: 'read' },
      },

    ],
  },
  {
    id: 'realtime',
    label: 'Real-time Features',
    href: '/realtime',
    icon: Wifi,
    permission: { resource: 'cases', action: 'read' }, // Using cases permission for realtime features
  },
  {
    id: 'forms',
    label: 'Form Viewer',
    href: '/forms',
    icon: FileText,
    permission: { resource: 'cases', action: 'read' }, // Using cases permission for forms
  },
  {
    id: 'security-ux',
    label: 'Security & UX',
    href: '/security-ux',
    icon: Shield,
    permission: { resource: 'settings', action: 'read' },
  },
];
