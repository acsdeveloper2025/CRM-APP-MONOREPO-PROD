import * as React from 'react';

import { cn } from '@/lib/utils';
import { shouldUppercaseInput } from '@/lib/uppercase';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  // Opt out (false) or force in (true) the global uppercase-on-type policy.
  // Unset = auto-detect via shouldUppercaseInput(type, name).
  uppercase?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, uppercase, onChange, ...props }, ref) => {
    const autoUpper = shouldUppercaseInput(type, props.name, uppercase, props.id);
    const handleChange = autoUpper
      ? (e: React.ChangeEvent<HTMLInputElement>) => {
          const upper = e.target.value.toUpperCase();
          if (upper !== e.target.value) {
            e.target.value = upper;
          }
          onChange?.(e);
        }
      : onChange;
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
          // Keep the display in lockstep with the stored value. When auto-
          // upper is off (email/password/username/...), opt out of the
          // global body-uppercase CSS so the user sees exactly what they
          // typed.
          !autoUpper && 'case-sensitive',
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
