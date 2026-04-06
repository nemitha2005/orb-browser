import { toNavigableUrl } from './url';
import type { BrowserBounds, TabSnapshot, TabsStateSnapshot } from './ipc-contract';

function parseStringPayload(payload: unknown, maxLen = 2048): string | null {
  if (typeof payload !== 'string') {
    return null;
  }

  const trimmedPayload = payload.trim();
  if (!trimmedPayload || trimmedPayload.length > maxLen) {
    return null;
  }

  return trimmedPayload;
}

export function parseFloatNavigatePayload(payload: unknown): string | null {
  const parsedPayload = parseStringPayload(payload);
  return parsedPayload ? toNavigableUrl(parsedPayload) : null;
}

export function parseTabIdPayload(payload: unknown): number | null {
  return typeof payload === 'number' && Number.isInteger(payload) && payload > 0
    ? payload
    : null;
}

export function parseTabNavigatePayload(payload: unknown): string | null {
  const parsedPayload = parseStringPayload(payload);
  return parsedPayload ? toNavigableUrl(parsedPayload) : null;
}

export function parseBrowserBoundsPayload(payload: unknown): BrowserBounds | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const bounds = payload as Record<string, unknown>;
  if (
    typeof bounds.x !== 'number' ||
    bounds.x < 0 ||
    typeof bounds.y !== 'number' ||
    bounds.y < 0 ||
    typeof bounds.width !== 'number' ||
    bounds.width < 1 ||
    typeof bounds.height !== 'number' ||
    bounds.height < 1
  ) {
    return null;
  }

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function isTabSnapshot(payload: unknown): payload is TabSnapshot {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const tab = payload as Record<string, unknown>;
  return (
    typeof tab.id === 'number' &&
    Number.isInteger(tab.id) &&
    tab.id > 0 &&
    typeof tab.title === 'string' &&
    (typeof tab.url === 'string' || tab.url === null) &&
    typeof tab.isLoading === 'boolean' &&
    typeof tab.canGoBack === 'boolean' &&
    typeof tab.canGoForward === 'boolean'
  );
}

export function parseTabsStateSnapshotPayload(payload: unknown): TabsStateSnapshot | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const state = payload as Record<string, unknown>;
  const { tabs, activeTabId } = state;

  const areTabsValid = Array.isArray(tabs) && tabs.every(isTabSnapshot);
  const isActiveTabValid =
    activeTabId === null ||
    (typeof activeTabId === 'number' && Number.isInteger(activeTabId) && activeTabId > 0);

  if (!areTabsValid || !isActiveTabValid) {
    return null;
  }

  return {
    tabs,
    activeTabId,
  };
}
