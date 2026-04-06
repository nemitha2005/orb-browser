import { z } from 'zod';

import { toNavigableUrl } from './url';

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TabSnapshot {
  id: number;
  title: string;
  url: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface TabsStateSnapshot {
  tabs: TabSnapshot[];
  activeTabId: number | null;
}

export const IPC_CHANNELS = {
  TOGGLE_FLOAT: 'toggle-float',
  FLOAT_NAVIGATE: 'float-navigate',
  OPEN_URL: 'open-url',
  TAB_CREATE: 'tab-create',
  TAB_CLOSE: 'tab-close',
  TAB_ACTIVATE: 'tab-activate',
  TAB_NAVIGATE: 'tab-navigate',
  TAB_GO_BACK: 'tab-go-back',
  TAB_GO_FORWARD: 'tab-go-forward',
  TAB_RELOAD: 'tab-reload',
  TAB_SET_BOUNDS: 'tab-set-bounds',
  TABS_GET_STATE: 'tabs-get-state',
  TABS_STATE_CHANGED: 'tabs-state-changed',
} as const;

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
