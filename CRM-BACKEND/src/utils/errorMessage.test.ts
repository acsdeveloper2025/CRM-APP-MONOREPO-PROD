import { describe, it, expect } from 'vitest';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('returns the .message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns subclasses of Error too', () => {
    class CustomError extends Error {}
    expect(errorMessage(new CustomError('subclass-boom'))).toBe('subclass-boom');
  });

  it('passes strings through unchanged', () => {
    expect(errorMessage('a string error')).toBe('a string error');
    expect(errorMessage('')).toBe('');
  });

  it('coerces primitives without falling back to "[object Object]"', () => {
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(true)).toBe('true');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('JSON-stringifies plain serialisable objects', () => {
    expect(errorMessage({ code: 'X', detail: 'y' })).toBe('{"code":"X","detail":"y"}');
    expect(errorMessage([1, 2, 3])).toBe('[1,2,3]');
  });

  it('falls back to a tag for circular / unserialisable objects', () => {
    interface Cycle {
      self?: Cycle;
    }
    const cycle: Cycle = {};
    cycle.self = cycle;
    expect(errorMessage(cycle)).toBe('[unserialisable error]');
  });
});
