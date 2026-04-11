/**
 * Adapter that re-exports react-day-picker's snake_case enum members as
 * camelCase aliases.
 *
 * react-day-picker v9 exposes `SelectionState` and `DayFlag` enums whose
 * member names (`range_end`, `range_middle`, etc.) are snake_case — this is
 * the library's API, not our convention. This file is the single place in
 * the frontend where we touch those names; every other file (including the
 * `calendar.tsx` wrapper) imports the camelCase aliases from here, so
 * application code stays camelCase end-to-end.
 *
 * Think of this as the `rowTransform.ts` equivalent for the react-day-picker
 * boundary.
 */
import { SelectionState, DayFlag } from 'react-day-picker';

/** camelCase aliases for the library's SelectionState enum. */
 
export const Selection = Object.freeze({
  rangeEnd: SelectionState.range_end,
  rangeMiddle: SelectionState.range_middle,
  rangeStart: SelectionState.range_start,
  selected: SelectionState.selected,
});

/** camelCase aliases for the library's DayFlag enum.
 *  (Every member already is a single word, so the rename is identity — we
 *  still re-export through this adapter so consumers never import
 *  react-day-picker enums directly.) */
export const Day = Object.freeze({
  disabled: DayFlag.disabled,
  hidden: DayFlag.hidden,
  outside: DayFlag.outside,
  focused: DayFlag.focused,
  today: DayFlag.today,
});
