import { describe, it, expect } from 'vitest';
import { resolveAssetUrl } from './assetUrl';

describe('resolveAssetUrl', () => {
  it('returns undefined for empty/nullish input', () => {
    expect(resolveAssetUrl(null)).toBeUndefined();
    expect(resolveAssetUrl(undefined)).toBeUndefined();
    expect(resolveAssetUrl('')).toBeUndefined();
  });

  it('passes absolute http(s) URLs and data URIs through unchanged', () => {
    expect(resolveAssetUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(resolveAssetUrl('http://x/y.png')).toBe('http://x/y.png');
    expect(resolveAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('prefixes server-relative paths with the uploads origin', () => {
    const out = resolveAssetUrl('/uploads/profile-photos/u1.jpg');
    expect(out).toBeDefined();
    expect(out!.endsWith('/uploads/profile-photos/u1.jpg')).toBe(true);
    // origin is absolute, so the resolved URL is longer than the path alone
    expect(out!.length).toBeGreaterThan('/uploads/profile-photos/u1.jpg'.length);
  });

  it('returns non-rooted relative strings unchanged', () => {
    expect(resolveAssetUrl('foo.jpg')).toBe('foo.jpg');
  });
});
