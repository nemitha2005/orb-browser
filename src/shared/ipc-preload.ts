import { toNavigableUrl } from './url';
import type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
  HistorySnapshot,
  MenuAction,
  MenuInitPayload,
  MenuShowPayload,
  TabSnapshot,
  TabsStateSnapshot,
} from './ipc-contract';
import { MENU_ACTIONS } from './ipc-contract';

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

export function parseBookmarkIdPayload(payload: unknown): number | null {
  return typeof payload === 'number' && Number.isInteger(payload) && payload > 0
    ? payload
    : null;
}

export function parseBookmarkUpsertPayload(payload: unknown): BookmarkUpsertPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const bookmark = payload as Record<string, unknown>;
  if (typeof bookmark.url !== 'string') {
    return null;
  }

  const urlInput = bookmark.url.trim();
  if (!urlInput || urlInput.length > 2048) {
    return null;
  }

  const normalizedUrl = toNavigableUrl(urlInput);
  if (!normalizedUrl) {
    return null;
  }

  const titleInput =
    typeof bookmark.title === 'string' ? bookmark.title.trim() : '';
  const normalizedTitle = titleInput.slice(0, 512) || normalizedUrl;

  return {
    url: normalizedUrl,
    title: normalizedTitle,
  };
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

function isBookmarkSnapshot(payload: unknown): payload is BookmarkSnapshot {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const bookmark = payload as Record<string, unknown>;
  return (
    typeof bookmark.id === 'number' &&
    Number.isInteger(bookmark.id) &&
    bookmark.id > 0 &&
    typeof bookmark.url === 'string' &&
    bookmark.url.length > 0 &&
    typeof bookmark.title === 'string' &&
    typeof bookmark.createdAt === 'string' &&
    typeof bookmark.updatedAt === 'string'
  );
}

export function parseBookmarksSnapshotPayload(payload: unknown): BookmarkSnapshot[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  if (!payload.every(isBookmarkSnapshot)) {
    return null;
  }

  return payload;
}

function isHistorySnapshot(payload: unknown): payload is HistorySnapshot {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const historyEntry = payload as Record<string, unknown>;
  return (
    typeof historyEntry.id === 'number' &&
    Number.isInteger(historyEntry.id) &&
    historyEntry.id > 0 &&
    typeof historyEntry.url === 'string' &&
    historyEntry.url.length > 0 &&
    typeof historyEntry.title === 'string' &&
    typeof historyEntry.visitCount === 'number' &&
    Number.isInteger(historyEntry.visitCount) &&
    historyEntry.visitCount >= 0 &&
    typeof historyEntry.lastVisitedAt === 'string'
  );
}

export function parseHistorySnapshotsPayload(payload: unknown): HistorySnapshot[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  if (!payload.every(isHistorySnapshot)) {
    return null;
  }

  return payload;
}

const validMenuActions: ReadonlySet<string> = new Set(Object.values(MENU_ACTIONS));

export function parseMenuActionPayload(payload: unknown): MenuAction | null {
  if (typeof payload !== 'string' || !validMenuActions.has(payload)) {
    return null;
  }

  return payload as MenuAction;
}

export function parseMenuShowPayload(payload: unknown): MenuShowPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.screenX !== 'number' || typeof p.screenY !== 'number') {
    return null;
  }

  if (typeof p.isBookmarkBarVisible !== 'boolean') {
    return null;
  }

  if (p.theme !== 'light' && p.theme !== 'dark') {
    return null;
  }

  return {
    screenX: p.screenX,
    screenY: p.screenY,
    isBookmarkBarVisible: p.isBookmarkBarVisible,
    theme: p.theme,
  };
}

export function parseMenuInitPayload(payload: unknown): MenuInitPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.isBookmarkBarVisible !== 'boolean') {
    return null;
  }

  if (p.theme !== 'light' && p.theme !== 'dark') {
    return null;
  }

  return { isBookmarkBarVisible: p.isBookmarkBarVisible, theme: p.theme };
}
