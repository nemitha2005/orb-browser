import { z } from 'zod';

import { toNavigableUrl } from './url';
import type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
  DownloadSnapshot,
  HistorySnapshot,
  MenuAction,
  MenuInitPayload,
  MenuShowPayload,
  TabsStateSnapshot,
} from './ipc-contract';
import { MENU_ACTIONS } from './ipc-contract';
export { IPC_CHANNELS, MENU_ACTIONS } from './ipc-contract';
export type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
  DownloadSnapshot,
  HistorySnapshot,
  MenuAction,
  MenuInitPayload,
  MenuShowPayload,
  TabSnapshot,
  TabsStateSnapshot,
} from './ipc-contract';

const FloatNavigatePayloadSchema = z.string().trim().min(1).max(2048);
const TabIdPayloadSchema = z.number().int().positive();
const TabNavigatePayloadSchema = z.string().trim().min(1).max(2048);
const TabCreatePayloadSchema = z
  .object({
    url: z.string().trim().max(2048).optional().nullable(),
  })
  .optional();
const BrowserBoundsPayloadSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
});
const TabSnapshotPayloadSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  url: z.string().nullable(),
  isLoading: z.boolean(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
});
const TabsStateSnapshotPayloadSchema = z.object({
  tabs: z.array(TabSnapshotPayloadSchema),
  activeTabId: z.number().int().positive().nullable(),
});
const BookmarkSnapshotPayloadSchema = z.object({
  id: z.number().int().positive(),
  url: z.string().trim().min(1),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const BookmarkUpsertPayloadSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: z.string().trim().max(512).optional().nullable(),
});
const BookmarksSnapshotPayloadSchema = z.array(BookmarkSnapshotPayloadSchema);
const HistorySnapshotPayloadSchema = z.object({
  id: z.number().int().positive(),
  url: z.string().trim().min(1),
  title: z.string(),
  visitCount: z.number().int().nonnegative(),
  lastVisitedAt: z.string(),
});
const HistorySnapshotsPayloadSchema = z.array(HistorySnapshotPayloadSchema);
const DownloadSnapshotPayloadSchema = z.object({
  id: z.string().trim().min(1),
  url: z.string().trim().min(1),
  fileName: z.string(),
  savePath: z.string().trim().min(1),
  totalBytes: z.number().int().nonnegative(),
  receivedBytes: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
  state: z.enum(['progressing', 'paused', 'completed', 'cancelled', 'interrupted']),
  startedAt: z.string(),
  updatedAt: z.string(),
  speedBytesPerSecond: z.number().int().nonnegative(),
  canResume: z.boolean(),
});
const DownloadSnapshotsPayloadSchema = z.array(DownloadSnapshotPayloadSchema);
const DownloadIdPayloadSchema = z.string().trim().min(1).max(120);
const DownloadDirectoryPayloadSchema = z.string().trim().min(1).max(4096);

export function parseFloatNavigatePayload(payload: unknown): string | null {
  const parsedPayload = FloatNavigatePayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return null;
  }

  const navigableUrl = toNavigableUrl(parsedPayload.data);
  return navigableUrl || null;
}

export function parseTabIdPayload(payload: unknown): number | null {
  const parsedPayload = TabIdPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseBookmarkIdPayload(payload: unknown): number | null {
  const parsedPayload = TabIdPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseBookmarkUpsertPayload(payload: unknown): BookmarkUpsertPayload | null {
  const parsedPayload = BookmarkUpsertPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return null;
  }

  const normalizedUrl = toNavigableUrl(parsedPayload.data.url);
  if (!normalizedUrl) {
    return null;
  }

  const normalizedTitle = parsedPayload.data.title?.trim() || normalizedUrl;

  return {
    url: normalizedUrl,
    title: normalizedTitle,
  };
}

export function parseTabNavigatePayload(payload: unknown): string | null {
  const parsedPayload = TabNavigatePayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return null;
  }

  const navigableUrl = toNavigableUrl(parsedPayload.data);
  return navigableUrl || null;
}

export function parseTabCreatePayload(payload: unknown): string | null {
  const parsedPayload = TabCreatePayloadSchema.safeParse(payload);
  if (!parsedPayload.success || !parsedPayload.data?.url) {
    return null;
  }

  const navigableUrl = toNavigableUrl(parsedPayload.data.url);
  return navigableUrl || null;
}

export function parseBrowserBoundsPayload(payload: unknown): BrowserBounds | null {
  const parsedPayload = BrowserBoundsPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseTabsStateSnapshotPayload(payload: unknown): TabsStateSnapshot | null {
  const parsedPayload = TabsStateSnapshotPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseBookmarksSnapshotPayload(payload: unknown): BookmarkSnapshot[] | null {
  const parsedPayload = BookmarksSnapshotPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseHistorySnapshotsPayload(payload: unknown): HistorySnapshot[] | null {
  const parsedPayload = HistorySnapshotsPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseDownloadSnapshotsPayload(payload: unknown): DownloadSnapshot[] | null {
  const parsedPayload = DownloadSnapshotsPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseDownloadIdPayload(payload: unknown): string | null {
  const parsedPayload = DownloadIdPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

export function parseDownloadDirectoryPayload(payload: unknown): string | null {
  const parsedPayload = DownloadDirectoryPayloadSchema.safeParse(payload);
  return parsedPayload.success ? parsedPayload.data : null;
}

const MenuActionPayloadSchema = z.enum(
  Object.values(MENU_ACTIONS) as [MenuAction, ...MenuAction[]],
);

const MenuShowPayloadSchema = z.object({
  screenX: z.number(),
  screenY: z.number(),
  isBookmarkBarVisible: z.boolean(),
  theme: z.enum(['light', 'dark']),
});

export function parseMenuActionPayload(payload: unknown): MenuAction | null {
  const result = MenuActionPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}

export function parseMenuShowPayload(payload: unknown): MenuShowPayload | null {
  const result = MenuShowPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
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
