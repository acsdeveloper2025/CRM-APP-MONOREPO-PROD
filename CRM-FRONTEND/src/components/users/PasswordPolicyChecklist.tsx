import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPasswordPolicyChecks } from '@/lib/passwordPolicy';

interface PasswordPolicyChecklistProps {
  password: string;
  className?: string;
}

export function PasswordPolicyChecklist({ password, className }: PasswordPolicyChecklistProps) {
  const checks = getPasswordPolicyChecks(password || '');

  const rules = [
    { key: 'minLength', label: 'At least 8 characters', valid: checks.minLength },
    { key: 'hasUppercase', label: 'At least 1 uppercase letter (A-Z)', valid: checks.hasUppercase },
    { key: 'hasLowercase', label: 'At least 1 lowercase letter (a-z)', valid: checks.hasLowercase },
    { key: 'hasNumber', label: 'At least 1 number (0-9)', valid: checks.hasNumber },
    { key: 'hasSpecialChar', label: 'At least 1 special character', valid: checks.hasSpecialChar },
  ];

  return (
    <div {...{ className: cn('rounded-md border border-green-100 bg-green-50 p-3', className) }}>
      <p {...{ className: "text-xs font-medium text-green-800 mb-2" }}>Password requirements</p>
      <div {...{ className: "space-y-1.5" }}>
        {rules.map((rule) => (
          <div key={rule.key} {...{ className: "flex items-center gap-2 text-xs" }}>
            {rule.valid ? (
              <CheckCircle2 {...{ className: "h-3.5 w-3.5 text-green-600" }} />
            ) : (
              <Circle {...{ className: "h-3.5 w-3.5 text-gray-400" }} />
            )}
            <span {...{ className: rule.valid ? 'text-green-700' : 'text-gray-600' }}>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
