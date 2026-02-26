import React from 'react';
import {
  Crown,
  Server,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normalizeUserRole } from '@/types/constants';

export interface RoleConfig {
  icon: React.ComponentType<{ className?: string }>;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label: string;
  color: string;
}

export const roleConfigs: Record<string, RoleConfig> = {
  SUPER_ADMIN: {
    icon: Crown,
    variant: 'destructive',
    label: 'Super Admin',
    color: 'text-red-600'
  },
  BACKEND_USER: {
    icon: Server,
    variant: 'secondary',
    label: 'Backend User',
    color: 'text-blue-600'
  },
  FIELD_AGENT: {
    icon: MapPin,
    variant: 'outline',
    label: 'Field Agent',
    color: 'text-purple-600'
  }
};

export const getRoleIcon = (roleName: string, size: 'sm' | 'md' | 'lg' = 'md') => {
  const config = roleConfigs[normalizeUserRole(roleName) || 'BACKEND_USER'] || roleConfigs.BACKEND_USER;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  return <Icon className={`${sizeClasses[size]} ${config.color}`} />;
};

export const getRoleBadge = (roleName: string) => {
  const config = roleConfigs[normalizeUserRole(roleName) || 'BACKEND_USER'] || roleConfigs.BACKEND_USER;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const getRoleConfig = (roleName: string): RoleConfig => {
  return roleConfigs[normalizeUserRole(roleName) || 'BACKEND_USER'] || roleConfigs.BACKEND_USER;
};
