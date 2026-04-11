import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, UI } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button-variants';
import { Selection, Day } from './calendar-adapter';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Wrapper around react-day-picker v9's DayPicker. We style every UI part via
 * the library's typed `UI` enum (PascalCase members → snake_case values) and
 * via the camelCase `Selection` / `Day` aliases in `calendar-adapter.ts`.
 *
 * Net effect: this file contains zero snake_case identifiers. The only place
 * the frontend touches the library's raw snake_case member names is
 * `calendar-adapter.ts`, which is the single boundary adapter.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        [UI.Months]: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        [UI.Month]: 'space-y-4',
        [UI.MonthCaption]: 'flex justify-center pt-1 relative items-center',
        [UI.CaptionLabel]: 'text-sm font-medium',
        [UI.Nav]: 'space-x-1 flex items-center',
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        [UI.MonthGrid]: 'w-full border-collapse space-y-1',
        [UI.Weekdays]: 'flex',
        [UI.Weekday]: 'text-gray-600 rounded-md w-9 font-normal text-[0.8rem]',
        [UI.Week]: 'flex w-full mt-2',
        [UI.Day]:
          'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        [UI.DayButton]: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        [Selection.rangeEnd]: 'day-range-end',
        [Selection.selected]:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        [Day.today]: 'bg-accent text-accent-foreground',
        [Day.outside]:
          'day-outside text-gray-600 opacity-50 aria-selected:bg-accent/50 aria-selected:text-gray-600 aria-selected:opacity-30',
        [Day.disabled]: 'text-gray-600 opacity-50',
        [Selection.rangeMiddle]: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        [Day.hidden]: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ..._props }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
