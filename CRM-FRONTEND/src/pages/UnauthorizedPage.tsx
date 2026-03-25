import React from 'react';
import { ShieldAlert } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="h-10 w-10 mx-auto text-red-600 mb-3" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-gray-600 mt-2">
          Access Denied - You do not have permission to access this module.
        </p>
      </div>
    </div>
  );
}
