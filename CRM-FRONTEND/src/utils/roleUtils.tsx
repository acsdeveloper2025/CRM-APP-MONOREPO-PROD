import React from 'react';
import { 
  Shield, 
  Crown, 
  Server, 
  Building2, 
  MapPin, 
  User,
  UserCog,
  Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface RoleConfig {
  icon: React.ComponentType<any>;
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
  ADMIN: {
    icon: Crown,
    variant: 'default',
    label: 'Admin',
    color: 'text-yellow-600'
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
  },
  MANAGER: {
    icon: UserCog,
    variant: 'outline',
    label: 'Manager',
    color: 'text-orange-600'
  },
  REPORT_PERSON: {
    icon: UserCog,
    variant: 'outline',
    label: 'Report Person',
    color: 'text-green-600'
  }
};

export const getRoleIcon = (roleName: string, size: 'sm' | 'md' | 'lg' = 'md') => {
  const config = roleConfigs[roleName] || roleConfigs.MANAGER;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  return <Icon className={`${sizeClasses[size]} ${config.color}`} />;
};

export const getRoleBadge = (roleName: string) => {
  const config = roleConfigs[roleName] || roleConfigs.MANAGER;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const getRoleConfig = (roleName: string): RoleConfig => {
  return roleConfigs[roleName] || roleConfigs.MANAGER;
};
