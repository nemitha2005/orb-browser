import { describe, expect, it } from 'vitest';

import { normalizeHttpUrl, toNavigableUrl } from '../src/shared/url';

describe('normalizeHttpUrl', () => {
  it('normalizes domain inputs to https', () => {
    expect(normalizeHttpUrl('example.com')).toBe('https://example.com/');
  });

  it('rejects non-http schemes', () => {
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('toNavigableUrl', () => {
  it('returns direct URL for domains', () => {
    expect(toNavigableUrl('github.com')).toBe('https://github.com/');
  });

  it('converts free text to search URL', () => {
    expect(toNavigableUrl('orb browser')).toContain('google.com/search?q=orb%20browser');
  });

  it('converts dangerous scheme text to search URL', () => {
    expect(toNavigableUrl('javascript:alert(1)')).toContain(
      'google.com/search?q=javascript%3Aalert(1)',
    );
  });
});
