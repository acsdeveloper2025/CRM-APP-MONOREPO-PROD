import * as React from 'react';

import { cn } from '@/lib/utils';
import { shouldUppercaseInput } from '@/lib/uppercase';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  // Opt out (false) or force in (true) the global uppercase-on-type policy.
  // Unset = auto-detect via shouldUppercaseInput(undefined, name).
  uppercase?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, uppercase, onChange, ...props }, ref) => {
    const autoUpper = shouldUppercaseInput(undefined, props.name, uppercase, props.id);
    const handleChange = autoUpper
      ? (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const upper = e.target.value.toUpperCase();
          if (upper !== e.target.value) {
            e.target.value = upper;
          }
          onChange?.(e);
        }
      : onChange;
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
          // See input.tsx — keep display in lockstep with stored value.
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
Textarea.displayName = 'Textarea';

export { Textarea };
