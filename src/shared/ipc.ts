import { z } from 'zod';

import { toNavigableUrl } from './url';
import type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
  TabsStateSnapshot,
} from './ipc-contract';
export { IPC_CHANNELS } from './ipc-contract';
export type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
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
