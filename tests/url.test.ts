import { describe, expect, it, vi } from 'vitest';

import {
  requestNavigateActiveTab,
  requestTabClose,
  requestTabCloseIfActive,
  requestTabCreate,
} from '../src/renderer/interaction';
import { normalizeHttpUrl, toNavigableUrl } from '../src/shared/url';

function createMockOrb() {
  return {
    createTab: vi.fn().mockResolvedValue(undefined),
    closeTab: vi.fn().mockResolvedValue(undefined),
    navigateActiveTab: vi.fn().mockResolvedValue(undefined),
  };
}

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

describe('renderer interaction smoke flow', () => {
  it('creates, searches, and closes active tab', () => {
    const orb = createMockOrb();

    requestTabCreate(orb);
    const navigatedValue = requestNavigateActiveTab(orb, '  orb browser  ');
    const didClose = requestTabCloseIfActive(orb, 3);

    expect(navigatedValue).toBe('orb browser');
    expect(didClose).toBe(true);
    expect(orb.createTab).toHaveBeenCalledTimes(1);
    expect(orb.navigateActiveTab).toHaveBeenCalledWith('orb browser');
    expect(orb.closeTab).toHaveBeenCalledWith(3);
  });

  it('ignores blank search and invalid close requests', () => {
    const orb = createMockOrb();

    const navigatedValue = requestNavigateActiveTab(orb, '   ');
    const didCloseInactive = requestTabCloseIfActive(orb, null);
    const didCloseInvalid = requestTabClose(orb, -1);

    expect(navigatedValue).toBeNull();
    expect(didCloseInactive).toBe(false);
    expect(didCloseInvalid).toBe(false);
    expect(orb.navigateActiveTab).not.toHaveBeenCalled();
    expect(orb.closeTab).not.toHaveBeenCalled();
  });
});
