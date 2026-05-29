import { describe, it, expect } from 'vitest';
import {
  getPasswordPolicyChecks,
  isPasswordPolicyValid,
  PASSWORD_POLICY,
} from './passwordPolicy';

describe('getPasswordPolicyChecks', () => {
  it('reports each rule independently for a weak password', () => {
    const checks = getPasswordPolicyChecks('abc');
    expect(checks).toEqual({
      minLength: false,
      hasLowercase: true,
      hasUppercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });
  });

  it('reports all rules satisfied for a strong password', () => {
    const checks = getPasswordPolicyChecks('Abcdef1!');
    expect(checks).toEqual({
      minLength: true,
      hasLowercase: true,
      hasUppercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });
  });

  it('treats exactly minLength characters as long enough', () => {
    expect(getPasswordPolicyChecks('a'.repeat(PASSWORD_POLICY.minLength)).minLength).toBe(true);
    expect(getPasswordPolicyChecks('a'.repeat(PASSWORD_POLICY.minLength - 1)).minLength).toBe(false);
  });
});

describe('isPasswordPolicyValid', () => {
  it('accepts a password meeting all five rules', () => {
    expect(isPasswordPolicyValid('Abcdef1!')).toBe(true);
  });

  it.each([
    ['too short', 'Ab1!'],
    ['no lowercase', 'ABCDEF1!'],
    ['no uppercase', 'abcdef1!'],
    ['no number', 'Abcdefg!'],
    ['no special char', 'Abcdef12'],
  ])('rejects when %s', (_label, pw) => {
    expect(isPasswordPolicyValid(pw)).toBe(false);
  });
});
