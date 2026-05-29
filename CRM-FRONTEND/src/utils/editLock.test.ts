import { describe, it, expect } from 'vitest';
import { isEditable, editBlockedReason, extractEditBlockedError } from './editLock';

describe('isEditable', () => {
  it('treats nullish status as editable', () => {
    expect(isEditable(null)).toBe(true);
    expect(isEditable(undefined)).toBe(true);
  });

  it('locks IN_PROGRESS / COMPLETED / REVOKED and allows the rest', () => {
    expect(isEditable('IN_PROGRESS')).toBe(false);
    expect(isEditable('COMPLETED')).toBe(false);
    expect(isEditable('REVOKED')).toBe(false);
    expect(isEditable('PENDING')).toBe(true);
    expect(isEditable('ASSIGNED')).toBe(true);
  });
});

describe('editBlockedReason', () => {
  it('returns null when editable', () => {
    expect(editBlockedReason('PENDING')).toBeNull();
  });

  it('gives a specific message for IN_PROGRESS and a generic one otherwise', () => {
    expect(editBlockedReason('IN_PROGRESS')).toBe(
      'Currently being processed; edits are not allowed.'
    );
    expect(editBlockedReason('COMPLETED')).toBe('Already completed; edits are not allowed.');
  });
});

describe('extractEditBlockedError', () => {
  it('returns null for unrelated errors', () => {
    expect(extractEditBlockedError(new Error('boom'))).toBeNull();
    expect(
      extractEditBlockedError({ response: { data: { error: { code: 'OTHER' } } } })
    ).toBeNull();
  });

  it('extracts message + currentStatus for EDIT_BLOCKED / TASK_LOCKED', () => {
    const out = extractEditBlockedError({
      response: {
        data: { message: 'locked', error: { code: 'EDIT_BLOCKED', currentStatus: 'IN_PROGRESS' } },
      },
    });
    expect(out).toEqual({ message: 'locked', currentStatus: 'IN_PROGRESS' });

    const taskLocked = extractEditBlockedError({
      response: { data: { error: { code: 'TASK_LOCKED' } } },
    });
    expect(taskLocked?.message).toBe('This record cannot be edited right now.');
  });
});
