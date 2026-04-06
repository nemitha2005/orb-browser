import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-contract';
import {
  parseBrowserBoundsPayload,
  parseFloatNavigatePayload,
  parseTabIdPayload,
  parseTabNavigatePayload,
  parseTabsStateSnapshotPayload,
} from '../shared/ipc-preload';
import type { BrowserBounds, TabsStateSnapshot } from '../shared/ipc-contract';

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
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const safeUrl = parseFloatNavigatePayload(payload);
      if (!safeUrl) {
        return;
      }

      callback(safeUrl);
    };

    ipcRenderer.on(IPC_CHANNELS.OPEN_URL, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.OPEN_URL, handler);
    };
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
