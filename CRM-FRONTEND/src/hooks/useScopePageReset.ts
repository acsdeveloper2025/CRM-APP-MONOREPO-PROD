import { useEffect, useRef } from 'react';
import { useActiveScope } from './useActiveScope';

/**
 * P18.M-04: run a reset callback whenever activeScope (client or
 * product) changes — typically used to bounce list pages back to
 * page=1 so the user doesn't get stranded on page 4 of an empty
 * result after switching scope.
 *
 * Skips the initial mount: the page's own default state already starts
 * at page 1; we only need to react to transitions.
 *
 * Usage:
 *   useScopePageReset(() => setPagination(p => ({ ...p, page: 1 })));
 *   // or simpler signature:
 *   useScopePageReset(() => setCurrentPage(1));
 *
 * The callback is captured by ref so callers can pass an inline arrow
 * without retriggering the effect every render. Only scope changes
 * fire it.
 */
export const useScopePageReset = (onScopeChange: () => void): void => {
  const { selectedClientId, selectedProductId } = useActiveScope();
  const initializedRef = useRef(false);
  const callbackRef = useRef(onScopeChange);
  callbackRef.current = onScopeChange;
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    callbackRef.current();
  }, [selectedClientId, selectedProductId]);
};
