import React from 'react';
import { Shield, Check, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RolePermission } from '@/types/user';
import { getRoleBadge, getRoleIcon } from '@/utils/roleUtils';

interface RolePermissionsTableProps {
  data: RolePermission[];
  isLoading: boolean;
}

export function RolePermissionsTable({ data, isLoading }: RolePermissionsTableProps) {
  if (isLoading) {
    return <LoadingState message="Loading role permissions..." size="lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-600" />
        <h3 className="mt-4 text-lg font-semibold">No permissions found</h3>
        <p className="text-gray-600">
          Role permissions will be displayed here.
        </p>
      </div>
    );
  }

  // Use the centralized role badge utility
  const getRoleDisplayBadge = (role: string) => {
    return getRoleBadge(role);
  };

  // Group permissions by module
  const groupPermissionsByModule = (permissions: any[]): Record<string, any[]> => {
    return permissions.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {} as Record<string, any[]>);
  };

  return (
    <div className="space-y-6">
      {data.map((rolePermission) => (
        <Card key={rolePermission.role}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getRoleIcon(rolePermission.role, 'lg')}
              {getRoleDisplayBadge(rolePermission.role)}
              <span>Permissions</span>
            </CardTitle>
            <CardDescription>
              Permissions and access levels for {rolePermission.role.toLowerCase()} role
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rolePermission.permissions.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupPermissionsByModule(rolePermission.permissions)).map(([module, permissions]) => (
                  <div key={module}>
                    <h4 className="font-medium text-sm text-gray-600 mb-3 uppercase tracking-wide">
                      {module}
                    </h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Permission</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead className="text-center">Access</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {permissions.map((permission) => (
                            <TableRow key={permission.id}>
                              <TableCell className="font-medium">
                                {permission.name}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {permission.description}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {permission.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Check className="h-4 w-4 text-green-600 mx-auto" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <X className="mx-auto h-8 w-8 text-gray-600" />
                <p className="text-sm text-gray-600 mt-2">
                  No permissions assigned to this role
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
