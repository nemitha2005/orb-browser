import { z } from 'zod';

import { toNavigableUrl } from './url';

export const IPC_CHANNELS = {
  TOGGLE_FLOAT: 'toggle-float',
  FLOAT_NAVIGATE: 'float-navigate',
  OPEN_URL: 'open-url',
} as const;

const FloatNavigatePayloadSchema = z.string().trim().min(1).max(2048);

export function parseFloatNavigatePayload(payload: unknown): string | null {
  const parsedPayload = FloatNavigatePayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return null;
  }

  const navigableUrl = toNavigableUrl(parsedPayload.data);
  return navigableUrl || null;
}
