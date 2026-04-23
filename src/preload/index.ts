import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-contract';
import {
  parseBookmarkIdPayload,
  parseBookmarksSnapshotPayload,
  parseBookmarkUpsertPayload,
  parseBrowserBoundsPayload,
  parseDownloadDirectoryPayload,
  parseDownloadIdPayload,
  parseDownloadSnapshotsPayload,
  parseFloatNavigatePayload,
  parseHistorySnapshotsPayload,
  parseMenuActionPayload,
  parseMenuInitPayload,
  parseMenuShowPayload,
  parseTabIdPayload,
  parseTabNavigatePayload,
  parseTabsStateSnapshotPayload,
} from '../shared/ipc-preload';
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
} from '../shared/ipc-contract';

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

  stop: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_STOP).then(() => undefined),

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

  getBookmarks: async (): Promise<BookmarkSnapshot[]> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.BOOKMARKS_GET);
    return parseBookmarksSnapshotPayload(payload) ?? [];
  },

  toggleActiveBookmark: async (): Promise<BookmarkSnapshot[]> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.BOOKMARKS_TOGGLE_ACTIVE);
    return parseBookmarksSnapshotPayload(payload) ?? [];
  },

  upsertBookmark: async (payload: BookmarkUpsertPayload): Promise<BookmarkSnapshot[]> => {
    const safePayload = parseBookmarkUpsertPayload(payload);
    if (!safePayload) {
      const fallbackPayload = await ipcRenderer.invoke(IPC_CHANNELS.BOOKMARKS_GET);
      return parseBookmarksSnapshotPayload(fallbackPayload) ?? [];
    }

    const responsePayload = await ipcRenderer.invoke(
      IPC_CHANNELS.BOOKMARKS_UPSERT,
      safePayload,
    );
    return parseBookmarksSnapshotPayload(responsePayload) ?? [];
  },

  removeBookmark: async (bookmarkId: number): Promise<BookmarkSnapshot[]> => {
    const safeBookmarkId = parseBookmarkIdPayload(bookmarkId);
    if (!safeBookmarkId) {
      const fallbackPayload = await ipcRenderer.invoke(IPC_CHANNELS.BOOKMARKS_GET);
      return parseBookmarksSnapshotPayload(fallbackPayload) ?? [];
    }

    const payload = await ipcRenderer.invoke(IPC_CHANNELS.BOOKMARKS_REMOVE, safeBookmarkId);
    return parseBookmarksSnapshotPayload(payload) ?? [];
  },

  onBookmarksChanged: (callback: (bookmarks: BookmarkSnapshot[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const parsedBookmarks = parseBookmarksSnapshotPayload(payload);
      if (!parsedBookmarks) {
        return;
      }

      callback(parsedBookmarks);
    };

    ipcRenderer.on(IPC_CHANNELS.BOOKMARKS_CHANGED, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.BOOKMARKS_CHANGED, handler);
    };
  },

  getHistory: async (): Promise<HistorySnapshot[]> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET);
    return parseHistorySnapshotsPayload(payload) ?? [];
  },

  getDownloads: async (): Promise<DownloadSnapshot[]> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_GET);
    return parseDownloadSnapshotsPayload(payload) ?? [];
  },

  getDownloadDirectory: async (): Promise<string> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_GET_DIRECTORY);
    return parseDownloadDirectoryPayload(payload) ?? '';
  },

  selectDownloadDirectory: async (): Promise<string> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_SELECT_DIRECTORY);
    return parseDownloadDirectoryPayload(payload) ?? '';
  },

  pauseDownload: (downloadId: string) => {
    const safeDownloadId = parseDownloadIdPayload(downloadId);
    if (!safeDownloadId) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_PAUSE, safeDownloadId).then(() => undefined);
  },

  resumeDownload: (downloadId: string) => {
    const safeDownloadId = parseDownloadIdPayload(downloadId);
    if (!safeDownloadId) {
      return Promise.resolve();
    }

    return ipcRenderer
      .invoke(IPC_CHANNELS.DOWNLOADS_RESUME, safeDownloadId)
      .then(() => undefined);
  },

  cancelDownload: (downloadId: string) => {
    const safeDownloadId = parseDownloadIdPayload(downloadId);
    if (!safeDownloadId) {
      return Promise.resolve();
    }

    return ipcRenderer
      .invoke(IPC_CHANNELS.DOWNLOADS_CANCEL, safeDownloadId)
      .then(() => undefined);
  },

  removeDownload: (downloadId: string) => {
    const safeDownloadId = parseDownloadIdPayload(downloadId);
    if (!safeDownloadId) {
      return Promise.resolve();
    }

    return ipcRenderer
      .invoke(IPC_CHANNELS.DOWNLOADS_REMOVE, safeDownloadId)
      .then(() => undefined);
  },

  onDownloadsChanged: (callback: (downloads: DownloadSnapshot[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const parsedDownloads = parseDownloadSnapshotsPayload(payload);
      if (!parsedDownloads) {
        return;
      }

      callback(parsedDownloads);
    };

    ipcRenderer.on(IPC_CHANNELS.DOWNLOADS_CHANGED, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOADS_CHANGED, handler);
    };
  },

  clearHistory: async (): Promise<HistorySnapshot[]> => {
    const payload = await ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR);
    return parseHistorySnapshotsPayload(payload) ?? [];
  },

  onHistoryChanged: (callback: (history: HistorySnapshot[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const parsedHistory = parseHistorySnapshotsPayload(payload);
      if (!parsedHistory) {
        return;
      }

      callback(parsedHistory);
    };

    ipcRenderer.on(IPC_CHANNELS.HISTORY_CHANGED, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.HISTORY_CHANGED, handler);
    };
  },

  showMenu: (payload: MenuShowPayload) => {
    const safePayload = parseMenuShowPayload(payload);
    if (!safePayload) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.MENU_SHOW, safePayload).then(() => undefined);
  },

  menuAction: (action: MenuAction) => {
    const safeAction = parseMenuActionPayload(action);
    if (!safeAction) {
      return Promise.resolve();
    }

    return ipcRenderer.invoke(IPC_CHANNELS.MENU_ACTION, safeAction).then(() => undefined);
  },

  onMenuAction: (callback: (action: MenuAction) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const action = parseMenuActionPayload(payload);
      if (action) {
        callback(action);
      }
    };

    ipcRenderer.on(IPC_CHANNELS.MENU_ACTION_RELAY, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.MENU_ACTION_RELAY, handler);
    };
  },

  onMenuInit: (callback: (state: MenuInitPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      const state = parseMenuInitPayload(payload);
      if (state) {
        callback(state);
      }
    };

    ipcRenderer.on(IPC_CHANNELS.MENU_INIT, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.MENU_INIT, handler);
    };
  },

  platform: process.platform,
});
