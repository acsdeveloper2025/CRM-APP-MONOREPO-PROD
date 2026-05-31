/**
 * Characterization of the PURE scope-enforcement helpers in dataScope.ts —
 * valueAllowedByScope (the per-request allow/deny check that prevents
 * cross-tenant writes/reads) and appendOperationalScopeConditions (the SQL
 * WHERE-narrowing builder). Security-critical: these gate the data-leak
 * surface in DEFERRED_ITEMS §6. The DB-backed resolveDataScope is covered
 * separately by integration tests; module imports are mocked so these pure
 * units load without a DB.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/database', () => ({ query: vi.fn() }));
vi.mock('@/security/userScope', () => ({ getScopedOperationalUserIds: vi.fn() }));
vi.mock('@/security/rbacAccess', () => ({ isScopedOperationsUser: vi.fn() }));

import {
  valueAllowedByScope,
  appendOperationalScopeConditions,
  type ResolvedDataScope,
} from '@/security/dataScope';

describe('valueAllowedByScope', () => {
  it('allows everything when the scope is not restricted', () => {
    const scope: ResolvedDataScope = { restricted: false };
    expect(valueAllowedByScope({ userId: 'anyone', clientId: 999, productId: 999 }, scope)).toBe(true);
  });

  it('enforces the user dimension when restricted', () => {
    const scope: ResolvedDataScope = { restricted: true, scopedUserIds: ['u1', 'u2'] };
    expect(valueAllowedByScope({ userId: 'u1' }, scope)).toBe(true);
    expect(valueAllowedByScope({ userId: 'u3' }, scope)).toBe(false);
  });

  it('enforces the client dimension when restricted', () => {
    const scope: ResolvedDataScope = { restricted: true, assignedClientIds: [1, 2] };
    expect(valueAllowedByScope({ clientId: 2 }, scope)).toBe(true);
    expect(valueAllowedByScope({ clientId: 3 }, scope)).toBe(false);
  });

  it('enforces the product dimension when restricted', () => {
    const scope: ResolvedDataScope = { restricted: true, assignedProductIds: [5] };
    expect(valueAllowedByScope({ productId: 5 }, scope)).toBe(true);
    expect(valueAllowedByScope({ productId: 6 }, scope)).toBe(false);
  });

  it('skips a dimension when the value is null/undefined', () => {
    const scope: ResolvedDataScope = { restricted: true, assignedClientIds: [1] };
    expect(valueAllowedByScope({ clientId: null }, scope)).toBe(true);
    expect(valueAllowedByScope({}, scope)).toBe(true);
  });

  it('skips a dimension when the scope array for it is absent', () => {
    const scope: ResolvedDataScope = { restricted: true, scopedUserIds: ['u1'] };
    // clientId provided but scope has no assignedClientIds → not checked
    expect(valueAllowedByScope({ userId: 'u1', clientId: 999 }, scope)).toBe(true);
  });
});

describe('appendOperationalScopeConditions', () => {
  it('is a no-op when the scope is not restricted', () => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    appendOperationalScopeConditions({
      scope: { restricted: false },
      conditions,
      params,
      clientExpr: 'c.client_id',
    });
    expect(conditions).toEqual([]);
    expect(params).toEqual([]);
  });

  it('appends a clause + param per provided expression when restricted', () => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    appendOperationalScopeConditions({
      scope: { restricted: true, assignedClientIds: [1, 2], assignedProductIds: [5] },
      conditions,
      params,
      clientExpr: 'c.client_id',
      productExpr: 'c.product_id',
    });
    expect(conditions.length).toBe(2);
    expect(params).toContainEqual([1, 2]);
    expect(params).toContainEqual([5]);
    expect(conditions.join(' ')).toContain('c.client_id');
    expect(conditions.join(' ')).toContain('c.product_id');
  });
});
