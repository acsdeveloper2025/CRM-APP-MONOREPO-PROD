import { describe, it, expect } from 'vitest';
import { shouldUppercaseInput, toUpperCaseSafe } from './uppercase';

describe('shouldUppercaseInput', () => {
  describe('type-based exclusions', () => {
    it.each([
      ['email'],
      ['password'],
      ['url'],
      ['tel'],
      ['number'],
      ['date'],
      ['time'],
      ['datetime-local'],
      ['month'],
      ['week'],
      ['file'],
      ['hidden'],
      ['color'],
      ['range'],
    ])('returns false for type="%s"', (type) => {
      expect(shouldUppercaseInput(type, 'anything')).toBe(false);
    });

    it('matches type case-insensitively', () => {
      expect(shouldUppercaseInput('EMAIL', 'foo')).toBe(false);
      expect(shouldUppercaseInput('Password', 'foo')).toBe(false);
    });

    it('returns true for plain text', () => {
      expect(shouldUppercaseInput('text', 'metPersonName')).toBe(true);
    });

    it('returns true when type is undefined (default input is text)', () => {
      expect(shouldUppercaseInput(undefined, 'landmark1')).toBe(true);
    });
  });

  describe('name-based exclusions', () => {
    it.each([
      ['email'],
      ['userEmail'],
      ['primary_email'],
      ['EmailAddress'],
      ['password'],
      ['oldPassword'],
      ['password_confirmation'],
      ['username'],
      ['userName'],
      ['loginUsername'],
      ['url'],
      ['websiteUrl'],
      ['website'],
      ['homepage_link'],
      ['apiKey'],
      ['api_key'],
      ['secret'],
      ['clientSecret'],
      ['accessToken'],
      ['refreshToken'],
      ['jwt'],
      ['otp'],
      ['otpCode'],
      ['pin'],
      ['filename'],
      ['documentFilename'],
      ['filepath'],
      ['file_path'],
      ['path'],
    ])('returns false for name="%s" on a text input', (name) => {
      expect(shouldUppercaseInput('text', name)).toBe(false);
    });

    it.each([
      ['metPersonName'],
      ['tpcName1'],
      ['contactPerson'],
      ['otherObservation'],
      ['landmark1'],
      ['addressStructure'],
      ['clientName'],
      ['firstName'],
      ['lastName'],
      ['companyName'],
      ['nameOnDoorPlate'],
      ['search'],
      ['query'],
      // "code" and "slug" stay uppercasable (client code is uppercase-only anyway, idempotent)
      ['clientCode'],
      ['slug'],
      // "mobile" / "phone" are numeric in practice; no letters to transform
      ['mobileNumber'],
      ['phone'],
    ])('returns true for name="%s" on a text input', (name) => {
      expect(shouldUppercaseInput('text', name)).toBe(true);
    });
  });

  describe('explicit opt-out / opt-in', () => {
    it('explicit=false wins over everything', () => {
      expect(shouldUppercaseInput('text', 'anything', false)).toBe(false);
    });

    it('explicit=true wins over type exclusion', () => {
      expect(shouldUppercaseInput('email', 'email', true)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('no type, no name → default to true', () => {
      expect(shouldUppercaseInput()).toBe(true);
    });

    it('empty strings → default to true', () => {
      expect(shouldUppercaseInput('', '')).toBe(true);
    });
  });
});

describe('toUpperCaseSafe', () => {
  it('null → empty string', () => {
    expect(toUpperCaseSafe(null)).toBe('');
  });

  it('undefined → empty string', () => {
    expect(toUpperCaseSafe(undefined)).toBe('');
  });

  it('empty string → empty string', () => {
    expect(toUpperCaseSafe('')).toBe('');
  });

  it('lowercase → uppercase', () => {
    expect(toUpperCaseSafe('ramesh kumar')).toBe('RAMESH KUMAR');
  });

  it('mixed case → uppercase', () => {
    expect(toUpperCaseSafe('Ramesh Kumar')).toBe('RAMESH KUMAR');
  });

  it('already uppercase → unchanged', () => {
    expect(toUpperCaseSafe('RAMESH')).toBe('RAMESH');
  });

  it('number → uppercase string', () => {
    expect(toUpperCaseSafe(42)).toBe('42');
  });

  it('unicode accented characters', () => {
    expect(toUpperCaseSafe('ñoño')).toBe('ÑOÑO');
  });

  it('preserves punctuation and digits', () => {
    expect(toUpperCaseSafe('a-1 b_2')).toBe('A-1 B_2');
  });
});
