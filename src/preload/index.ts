import { contextBridge, ipcRenderer } from 'electron';

interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TabSnapshot {
  id: number;
  title: string;
  url: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface TabsStateSnapshot {
  tabs: TabSnapshot[];
  activeTabId: number | null;
}

const IPC_CHANNELS = {
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

const SCHEME_PREFIX_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const DOMAIN_LIKE_RE = /^[\w-]+(\.[\w-]+)+([/?#].*)?$/i;

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function normalizeHttpUrl(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const withScheme = SCHEME_PREFIX_RE.test(trimmedInput)
    ? trimmedInput
    : `https://${trimmedInput}`;

  const parsedUrl = parseUrl(withScheme);
  if (!parsedUrl || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
    return null;
  }

  return parsedUrl.toString();
}

function toNavigableUrl(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmedInput) || DOMAIN_LIKE_RE.test(trimmedInput)) {
    const normalizedUrl = normalizeHttpUrl(trimmedInput);
    if (normalizedUrl) {
      return normalizedUrl;
    }
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmedInput)}`;
}

function parseFloatNavigatePayload(payload: unknown): string | null {
  if (typeof payload !== 'string') {
    return null;
  }

  const trimmedPayload = payload.trim();
  if (!trimmedPayload || trimmedPayload.length > 2048) {
    return null;
  }

  const navigableUrl = toNavigableUrl(trimmedPayload);
  return navigableUrl || null;
}

function parseTabIdPayload(payload: unknown): number | null {
  return typeof payload === 'number' && Number.isInteger(payload) && payload > 0
    ? payload
    : null;
}

function parseTabNavigatePayload(payload: unknown): string | null {
  if (typeof payload !== 'string') {
    return null;
  }

  const trimmedPayload = payload.trim();
  if (!trimmedPayload || trimmedPayload.length > 2048) {
    return null;
  }

  const navigableUrl = toNavigableUrl(trimmedPayload);
  return navigableUrl || null;
}

function isBrowserBounds(payload: unknown): payload is BrowserBounds {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const bounds = payload as Record<string, unknown>;
  return (
    typeof bounds.x === 'number' &&
    bounds.x >= 0 &&
    typeof bounds.y === 'number' &&
    bounds.y >= 0 &&
    typeof bounds.width === 'number' &&
    bounds.width >= 1 &&
    typeof bounds.height === 'number' &&
    bounds.height >= 1
  );
}

function parseBrowserBoundsPayload(payload: unknown): BrowserBounds | null {
  return isBrowserBounds(payload) ? payload : null;
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

function parseTabsStateSnapshotPayload(payload: unknown): TabsStateSnapshot | null {
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

contextBridge.exposeInMainWorld('orb', {
  toggleFloat: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FLOAT),

  floatNavigate: (input: string) => {
    const safeUrl = parseFloatNavigatePayload(input);
    if (!safeUrl) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.FLOAT_NAVIGATE, safeUrl).then(() => undefined);
  },

  onOpenUrl: (callback: (url: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.OPEN_URL, (_event, payload: unknown) => {
      const safeUrl = parseFloatNavigatePayload(payload);
      if (!safeUrl) {
        return;
      }

      callback(safeUrl);
    });
  },

  createTab: (url?: string) => {
    const safeUrl = url ? parseTabNavigatePayload(url) : null;
    return ipcRenderer.invoke(IPC_CHANNELS.TAB_CREATE, { url: safeUrl });
  },

  closeTab: (tabId: number) => {
    const safeTabId = parseTabIdPayload(tabId);
    if (!safeTabId) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE, safeTabId).then(() => undefined);
  },

  activateTab: (tabId: number) => {
    const safeTabId = parseTabIdPayload(tabId);
    if (!safeTabId) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.TAB_ACTIVATE, safeTabId).then(() => undefined);
  },

  navigateActiveTab: (input: string) => {
    const safeUrl = parseTabNavigatePayload(input);
    if (!safeUrl) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.TAB_NAVIGATE, safeUrl).then(() => undefined);
  },

  goBack: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_GO_BACK).then(() => undefined),

  goForward: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_GO_FORWARD).then(() => undefined),

  reload: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_RELOAD).then(() => undefined),

  setBrowserBounds: (bounds: BrowserBounds) => {
    const safeBounds = parseBrowserBoundsPayload(bounds);
    if (!safeBounds) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.TAB_SET_BOUNDS, safeBounds).then(() => undefined);
  },

  getTabsState: async (): Promise<TabsStateSnapshot> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.TABS_GET_STATE);
    const parsedState = parseTabsStateSnapshotPayload(payload);

    return parsedState ?? { tabs: [], activeTabId: null };
  },

  onTabsStateChanged: (callback: (state: TabsStateSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const parsedState = parseTabsStateSnapshotPayload(payload);
      if (parsedState) {
        callback(parsedState);
      }
    };

    ipcRenderer.on(IPC_CHANNELS.TABS_STATE_CHANGED, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TABS_STATE_CHANGED, handler);
    };
  },

  platform: process.platform,
});
