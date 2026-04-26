import { app, BrowserView, BrowserWindow, dialog, ipcMain, screen, session, shell } from 'electron';
import Store from 'electron-store';
import { existsSync, statSync } from 'node:fs';
import path from 'path';

import {
  parseBookmarkIdPayload,
  parseBookmarkUpsertPayload,
  parseBrowserBoundsPayload,
  parseDownloadIdPayload,
  parseFloatNavigatePayload,
  parseMenuActionPayload,
  parseMenuShowPayload,
  parseTabCreatePayload,
  parseTabIdPayload,
  parseTabNavigatePayload,
} from '../shared/ipc';
import { IPC_CHANNELS } from '../shared/ipc-contract';
import type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
  DownloadSnapshot,
  HistorySnapshot,
  TabSnapshot,
  TabsStateSnapshot,
} from '../shared/ipc';
import { isHttpNavigationUrl } from '../shared/url';
import { initializeStorageLayer } from './storage';
import type { StorageLayer } from './storage';

const VITE_DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const RENDERER_DIST = path.join(__dirname, '../renderer');
const TABS_SESSION_KEY = 'tabsSession';
const DOWNLOADS_DIRECTORY_KEY = 'downloadsDirectory';
const MAX_RESTORED_TABS = 20;
const HISTORY_LIST_LIMIT = 200;
const DOWNLOADS_LIST_LIMIT = 200;

interface ManagedTab {
  id: number;
  title: string;
  url: string | null;
  isLoading: boolean;
  view: BrowserView;
}

interface PersistedTabSession {
  tabs: Array<{ url: string | null }>;
  activeTabIndex: number;
}

interface PersistedStateSchema {
  tabsSession: PersistedTabSession;
  downloadsDirectory: string;
}

type ManagedDownloadState =
  | 'progressing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'interrupted';

interface ManagedDownload {
  id: string;
  url: string;
  fileName: string;
  savePath: string;
  totalBytes: number;
  receivedBytes: number;
  state: ManagedDownloadState;
  startedAt: string;
  updatedAt: string;
  speedBytesPerSecond: number;
  canResume: boolean;
  item: Electron.DownloadItem | null;
  lastBytesSample: number;
  lastSampleAtMs: number;
}

const MENU_WIDTH = 220;
const MENU_HEIGHT = 272;

let mainWindow: BrowserWindow | null = null;
let floatWindow: BrowserWindow | null = null;
let menuWindow: BrowserWindow | null = null;
let menuWindowReady = false;
let attachedView: BrowserView | null = null;
let nextTabId = 1;
let activeTabId: number | null = null;
let tabs: ManagedTab[] = [];
let storageLayer: StorageLayer | null = null;
let persistedStateStore: Store<PersistedStateSchema> | null = null;
let managedDownloads: ManagedDownload[] = [];
let browserBounds: BrowserBounds = {
  x: 0,
  y: 120,
  width: 1200,
  height: 680,
};

function getPersistedStateStore(): Store<PersistedStateSchema> {
  if (!persistedStateStore) {
    persistedStateStore = new Store<PersistedStateSchema>({
      name: 'orb-state',
      defaults: {
        tabsSession: {
          tabs: [],
          activeTabIndex: 0,
        },
        downloadsDirectory: app.getPath('downloads'),
      },
    });
  }

  return persistedStateStore;
}

function isExistingDirectory(value: string): boolean {
  try {
    if (!value || !existsSync(value)) {
      return false;
    }

    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function getDefaultDownloadsDirectory(): string {
  try {
    return app.getPath('downloads');
  } catch {
    return app.getPath('userData');
  }
}

function getConfiguredDownloadsDirectory(): string {
  const configured = getPersistedStateStore().get(DOWNLOADS_DIRECTORY_KEY);
  if (typeof configured === 'string' && isExistingDirectory(configured)) {
    return configured;
  }

  const fallback = getDefaultDownloadsDirectory();
  getPersistedStateStore().set(DOWNLOADS_DIRECTORY_KEY, fallback);
  return fallback;
}

function setConfiguredDownloadsDirectory(directoryPath: string): string {
  if (!isExistingDirectory(directoryPath)) {
    return getConfiguredDownloadsDirectory();
  }

  getPersistedStateStore().set(DOWNLOADS_DIRECTORY_KEY, directoryPath);
  return directoryPath;
}

function buildUniqueDownloadPath(directoryPath: string, fileName: string): string {
  const parsedName = path.parse(fileName);
  const baseName = parsedName.name || 'download';
  const extension = parsedName.ext;
  const normalizedFileName = fileName || `${baseName}${extension}`;
  const initialPath = path.join(directoryPath, normalizedFileName);

  if (!existsSync(initialPath)) {
    return initialPath;
  }

  let index = 1;
  while (index < 10000) {
    const candidatePath = path.join(directoryPath, `${baseName} (${index})${extension}`);
    if (!existsSync(candidatePath)) {
      return candidatePath;
    }

    index += 1;
  }

  return path.join(directoryPath, `${baseName}-${Date.now()}${extension}`);
}

function toDownloadSnapshot(download: ManagedDownload): DownloadSnapshot {
  const safeTotalBytes = Math.max(0, download.totalBytes);
  const safeReceivedBytes = Math.max(
    0,
    Math.min(download.receivedBytes, safeTotalBytes || download.receivedBytes),
  );
  const percent =
    safeTotalBytes > 0
      ? Math.min(100, Math.round((safeReceivedBytes / safeTotalBytes) * 100))
      : 0;

  return {
    id: download.id,
    url: download.url,
    fileName: download.fileName,
    savePath: download.savePath,
    totalBytes: safeTotalBytes,
    receivedBytes: safeReceivedBytes,
    percent,
    state: download.state,
    startedAt: download.startedAt,
    updatedAt: download.updatedAt,
    speedBytesPerSecond: download.speedBytesPerSecond,
    canResume: download.canResume,
  };
}

function trimManagedDownloads(): void {
  if (managedDownloads.length <= DOWNLOADS_LIST_LIMIT) {
    return;
  }

  const activeDownloads = managedDownloads.filter(download => {
    return download.state === 'progressing' || download.state === 'paused';
  });
  const inactiveDownloads = managedDownloads
    .filter(download => download.state !== 'progressing' && download.state !== 'paused')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const availableInactiveSlots = Math.max(0, DOWNLOADS_LIST_LIMIT - activeDownloads.length);
  managedDownloads = [...activeDownloads, ...inactiveDownloads.slice(0, availableInactiveSlots)];
}

function getDownloadsSnapshot(): DownloadSnapshot[] {
  return managedDownloads
    .slice()
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .map(toDownloadSnapshot);
}

function findManagedDownload(downloadId: string): ManagedDownload | undefined {
  return managedDownloads.find(download => download.id === downloadId);
}

// Renderer pages should only navigate to local files (or devtools in development).
function isTrustedAppUrl(rawUrl: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'devtools:';
  } catch {
    return false;
  }
}

function isTabContents(contentsId: number): boolean {
  return tabs.some(tab => tab.view.webContents.id === contentsId);
}

function isWindowContents(contentsId: number): boolean {
  return (
    contentsId === mainWindow?.webContents.id ||
    contentsId === floatWindow?.webContents.id
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeNavigatedUrl(rawUrl: string | null): string | null {
  return rawUrl && isHttpNavigationUrl(rawUrl) ? rawUrl : null;
}

// ERR_ABORTED (-3) fires when a page redirects mid-load — not a real failure.
function isAbortError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === 'ERR_ABORTED'
  );
}

function getActiveTab(): ManagedTab | undefined {
  if (!activeTabId) {
    return undefined;
  }

  return tabs.find(tab => tab.id === activeTabId);
}

function serializeTab(tab: ManagedTab): TabSnapshot {
  const { webContents } = tab.view;
  const navigationHistory = webContents.navigationHistory;
  const canNavigate = tab.url !== null;

  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    isLoading: tab.isLoading,
    canGoBack: canNavigate ? navigationHistory.canGoBack() : false,
    canGoForward: canNavigate ? navigationHistory.canGoForward() : false,
  };
}

function getTabsStateSnapshot(): TabsStateSnapshot {
  return {
    tabs: tabs.map(serializeTab),
    activeTabId,
  };
}

function getBookmarksSnapshot(): BookmarkSnapshot[] {
  if (!storageLayer) {
    return [];
  }

  return storageLayer.bookmarks.list().map(bookmark => {
    return {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
    };
  });
}

function getHistorySnapshot(): HistorySnapshot[] {
  if (!storageLayer) {
    return [];
  }

  return storageLayer.history.listRecent(HISTORY_LIST_LIMIT).map(historyEntry => {
    return {
      id: historyEntry.id,
      url: historyEntry.url,
      title: historyEntry.title,
      visitCount: historyEntry.visitCount,
      lastVisitedAt: historyEntry.lastVisitedAt,
    };
  });
}

function emitBookmarksChanged(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.BOOKMARKS_CHANGED, getBookmarksSnapshot());
}

function emitHistoryChanged(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.HISTORY_CHANGED, getHistorySnapshot());
}

function emitDownloadsChanged(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.DOWNLOADS_CHANGED, getDownloadsSnapshot());
}

function registerDownloadSessionHandlers(): void {
  const defaultSession = session.defaultSession;

  defaultSession.on('will-download', (_event, item) => {
    const timestampMs = Date.now();
    const startedAt = new Date(timestampMs).toISOString();
    const sourceUrl = item.getURLChain().at(-1) ?? item.getURL() ?? '';
    const fileName = item.getFilename() || 'download';
    const savePath = buildUniqueDownloadPath(getConfiguredDownloadsDirectory(), fileName);
    const downloadId = `${timestampMs}-${Math.random().toString(36).slice(2, 10)}`;

    item.setSavePath(savePath);

    const managedDownload: ManagedDownload = {
      id: downloadId,
      url: sourceUrl,
      fileName,
      savePath,
      totalBytes: Math.max(0, item.getTotalBytes()),
      receivedBytes: Math.max(0, item.getReceivedBytes()),
      state: item.isPaused() ? 'paused' : 'progressing',
      startedAt,
      updatedAt: startedAt,
      speedBytesPerSecond: 0,
      canResume: item.canResume(),
      item,
      lastBytesSample: Math.max(0, item.getReceivedBytes()),
      lastSampleAtMs: timestampMs,
    };

    managedDownloads.unshift(managedDownload);
    trimManagedDownloads();
    emitDownloadsChanged();

    item.on('updated', (_updatedEvent, updateState) => {
      const download = findManagedDownload(downloadId);
      if (!download) {
        return;
      }

      const nowMs = Date.now();
      const receivedBytes = Math.max(0, item.getReceivedBytes());
      const totalBytes = Math.max(0, item.getTotalBytes());
      const deltaBytes = Math.max(0, receivedBytes - download.lastBytesSample);
      const deltaMs = Math.max(1, nowMs - download.lastSampleAtMs);

      download.receivedBytes = receivedBytes;
      download.totalBytes = totalBytes;
      download.speedBytesPerSecond = Math.round((deltaBytes * 1000) / deltaMs);
      download.lastBytesSample = receivedBytes;
      download.lastSampleAtMs = nowMs;
      download.updatedAt = new Date(nowMs).toISOString();
      download.canResume = item.canResume();

      if (updateState === 'interrupted') {
        download.state = 'interrupted';
      } else {
        download.state = item.isPaused() ? 'paused' : 'progressing';
      }

      emitDownloadsChanged();
    });

    item.once('done', (_doneEvent, doneState) => {
      const download = findManagedDownload(downloadId);
      if (!download) {
        return;
      }

      download.receivedBytes = Math.max(0, item.getReceivedBytes());
      download.totalBytes = Math.max(0, item.getTotalBytes());
      download.updatedAt = new Date().toISOString();
      download.canResume = item.canResume();
      download.speedBytesPerSecond = 0;
      download.item = null;

      if (doneState === 'completed') {
        download.state = 'completed';
      } else if (doneState === 'cancelled') {
        download.state = 'cancelled';
      } else {
        download.state = 'interrupted';
      }

      trimManagedDownloads();
      emitDownloadsChanged();
    });
  });
}

function toggleActiveBookmark(): BookmarkSnapshot[] {
  const activeTab = getActiveTab();
  if (!activeTab?.url || !storageLayer) {
    return getBookmarksSnapshot();
  }

  const existingBookmark = storageLayer.bookmarks
    .list()
    .find(bookmark => bookmark.url === activeTab.url);

  if (existingBookmark) {
    storageLayer.bookmarks.remove(existingBookmark.id);
  } else {
    const bookmarkTitle = activeTab.title || activeTab.url;
    storageLayer.bookmarks.upsert(activeTab.url, bookmarkTitle);
  }

  const bookmarks = getBookmarksSnapshot();
  emitBookmarksChanged();
  return bookmarks;
}

function removeBookmarkById(bookmarkId: number): BookmarkSnapshot[] {
  storageLayer?.bookmarks.remove(bookmarkId);

  const bookmarks = getBookmarksSnapshot();
  emitBookmarksChanged();
  return bookmarks;
}

function upsertBookmark(payload: BookmarkUpsertPayload): BookmarkSnapshot[] {
  if (!storageLayer) {
    return getBookmarksSnapshot();
  }

  storageLayer.bookmarks.upsert(payload.url, payload.title);

  const bookmarks = getBookmarksSnapshot();
  emitBookmarksChanged();
  return bookmarks;
}

function recordHistoryVisit(url: string | null, title: string | null): void {
  if (!storageLayer || !url || !isHttpNavigationUrl(url)) {
    return;
  }

  const historyTitle = title?.trim() || url;
  storageLayer.history.recordVisit(url, historyTitle);
  emitHistoryChanged();
}

function clearHistory(): HistorySnapshot[] {
  storageLayer?.history.clear();

  const history = getHistorySnapshot();
  emitHistoryChanged();
  return history;
}

function persistTabsSession(): void {
  const activeTabIndex = tabs.findIndex(tab => tab.id === activeTabId);
  const sessionSnapshot: PersistedTabSession = {
    tabs: tabs.map(tab => ({ url: tab.url })),
    activeTabIndex: activeTabIndex >= 0 ? activeTabIndex : 0,
  };

  try {
    getPersistedStateStore().set(TABS_SESSION_KEY, sessionSnapshot);
  } catch (error) {
    console.error('[main] failed to persist tabs session', error);
  }
}

function restoreTabsSession(): void {
  let persistedSession: PersistedTabSession;

  try {
    persistedSession = getPersistedStateStore().get(TABS_SESSION_KEY);
  } catch (error) {
    console.error('[main] failed to read tabs session', error);
    return;
  }

  if (!Array.isArray(persistedSession.tabs) || persistedSession.tabs.length === 0) {
    return;
  }

  const tabsToRestore = persistedSession.tabs.slice(0, MAX_RESTORED_TABS);
  tabsToRestore.forEach(tab => {
    const tabUrl =
      typeof tab.url === 'string' && isHttpNavigationUrl(tab.url)
        ? tab.url
        : null;

    createManagedTab(tabUrl);
  });

  const normalizedActiveTabIndex = Number.isInteger(persistedSession.activeTabIndex)
    ? persistedSession.activeTabIndex
    : 0;
  const safeActiveTabIndex = clamp(normalizedActiveTabIndex, 0, tabs.length - 1);
  activeTabId = tabs[safeActiveTabIndex]?.id ?? null;
}

// The renderer is UI-only now, so all browser state flows from main through this event.
function emitTabsState(): void {
  persistTabsSession();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(IPC_CHANNELS.TABS_STATE_CHANGED, getTabsStateSnapshot());
}

function closeFloatWindow(): void {
  if (!floatWindow || floatWindow.isDestroyed()) {
    floatWindow = null;
    return;
  }

  const windowToClose = floatWindow;
  floatWindow = null;
  windowToClose.close();
}

function closeMenuWindow(): void {
  if (!menuWindow || menuWindow.isDestroyed()) {
    menuWindow = null;
    return;
  }

  const windowToClose = menuWindow;
  menuWindow = null;
  menuWindowReady = false;
  windowToClose.close();
}

function detachAttachedView(): void {
  if (!mainWindow || !attachedView) {
    return;
  }

  const views = mainWindow.getBrowserViews();
  if (views.includes(attachedView)) {
    mainWindow.removeBrowserView(attachedView);
  }

  attachedView = null;
}

function applyAttachedViewBounds(): void {
  if (!mainWindow || !attachedView) {
    return;
  }

  const contentSize = mainWindow.getContentSize();
  const contentWidth = contentSize[0] ?? 1;
  const contentHeight = contentSize[1] ?? 1;
  const clampedX = clamp(browserBounds.x, 0, Math.max(0, contentWidth - 1));
  const clampedY = clamp(browserBounds.y, 0, Math.max(0, contentHeight - 1));

  // Width and height are constrained to remain inside the window content area.
  const clampedWidth = clamp(browserBounds.width, 1, Math.max(1, contentWidth - clampedX));
  const clampedHeight = clamp(browserBounds.height, 1, Math.max(1, contentHeight - clampedY));

  attachedView.setBounds({
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  });

  attachedView.setAutoResize({
    width: true,
    height: true,
  });
}

// Switching tabs is simply detach current BrowserView and attach the next one.
function attachActiveTabView(): void {
  if (!mainWindow) {
    return;
  }

  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.url) {
    detachAttachedView();
    return;
  }

  if (attachedView && attachedView !== activeTab.view) {
    const currentViews = mainWindow.getBrowserViews();
    if (currentViews.includes(attachedView)) {
      mainWindow.removeBrowserView(attachedView);
    }
  }

  const views = mainWindow.getBrowserViews();
  if (!views.includes(activeTab.view)) {
    mainWindow.addBrowserView(activeTab.view);
  }

  attachedView = activeTab.view;
  applyAttachedViewBounds();
}

function syncTabFromContents(contentsId: number, updater: (tab: ManagedTab) => void): void {
  const tab = tabs.find(entry => entry.view.webContents.id === contentsId);
  if (!tab) {
    return;
  }

  updater(tab);
  emitTabsState();
}

function configureTabEvents(tab: ManagedTab): void {
  const { webContents } = tab.view;

  // Tabs are locked to regular web protocols for safety.
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isHttpNavigationUrl(navigationUrl)) {
      event.preventDefault();
    }
  });

  webContents.on('did-start-loading', () => {
    syncTabFromContents(webContents.id, entry => {
      entry.isLoading = true;
    });
  });

  webContents.on('did-stop-loading', () => {
    const currentUrl = normalizeNavigatedUrl(webContents.getURL() || null);
    const currentTitle = webContents.getTitle() || null;

    syncTabFromContents(webContents.id, entry => {
      entry.isLoading = false;
      if (currentUrl) {
        entry.url = currentUrl;
      }
      entry.title = currentTitle || entry.title;
    });

    recordHistoryVisit(currentUrl, currentTitle);
  });

  webContents.on('did-navigate', (_event, navigationUrl) => {
    const currentUrl = normalizeNavigatedUrl(navigationUrl);
    if (!currentUrl) {
      return;
    }

    syncTabFromContents(webContents.id, entry => {
      entry.url = currentUrl;
    });
  });

  webContents.on('did-navigate-in-page', (_event, navigationUrl) => {
    const currentUrl = normalizeNavigatedUrl(navigationUrl);
    if (!currentUrl) {
      return;
    }

    syncTabFromContents(webContents.id, entry => {
      entry.url = currentUrl;
    });
  });

  webContents.on('page-title-updated', event => {
    event.preventDefault();
    syncTabFromContents(webContents.id, entry => {
      entry.title = webContents.getTitle() || entry.title;
    });
  });
}

function createManagedTab(initialUrl: string | null): ManagedTab {
  // Every tab owns one BrowserView instance that stays alive until tab close.
  const tabView = new BrowserView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  const tab: ManagedTab = {
    id: nextTabId,
    title: initialUrl ? 'Loading...' : 'New Tab',
    url: initialUrl,
    isLoading: false,
    view: tabView,
  };
  nextTabId += 1;

  configureTabEvents(tab);

  if (initialUrl) {
    tab.view.webContents.loadURL(initialUrl).catch(error => {
      if (!isAbortError(error)) {
        console.error('[main] failed to load URL', error);
      }
    });
  }

  tabs.push(tab);
  return tab;
}

function setActiveTab(tabId: number): void {
  const tabExists = tabs.some(tab => tab.id === tabId);
  if (!tabExists) {
    return;
  }

  activeTabId = tabId;
  attachActiveTabView();
  emitTabsState();
}

function createTab(initialUrl: string | null = null): ManagedTab {
  const tab = createManagedTab(initialUrl);
  setActiveTab(tab.id);
  return tab;
}

function destroyManagedTab(tab: ManagedTab): void {
  if (attachedView === tab.view) {
    attachedView = null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    const views = mainWindow.getBrowserViews();
    if (views.includes(tab.view)) {
      mainWindow.removeBrowserView(tab.view);
    }
  }

  const { webContents } = tab.view;
  webContents.removeAllListeners();

  if (!webContents.isDestroyed()) {
    webContents.close();
  }
}

function closeTab(tabId: number): void {
  const tabIndex = tabs.findIndex(tab => tab.id === tabId);
  if (tabIndex < 0) {
    return;
  }

  const [tabToClose] = tabs.splice(tabIndex, 1);
  if (!tabToClose) {
    return;
  }

  destroyManagedTab(tabToClose);

  if (tabs.length === 0) {
    const replacement = createManagedTab(null);
    activeTabId = replacement.id;
    attachActiveTabView();
    emitTabsState();
    return;
  }

  if (activeTabId === tabId) {
    const nextTab = tabs[Math.min(tabIndex, tabs.length - 1)];
    activeTabId = nextTab?.id ?? null;
  }

  attachActiveTabView();
  emitTabsState();
}

function navigateActiveTab(rawInput: string): void {
  const activeTab = getActiveTab();
  if (!activeTab) {
    createTab(rawInput);
    return;
  }

  activeTab.url = rawInput;
  attachActiveTabView();
  activeTab.view.webContents.loadURL(rawInput).catch(error => {
    if (!isAbortError(error)) {
      console.error('[main] failed to navigate tab', error);
    }
  });

  emitTabsState();
}

function destroyAllTabs(): void {
  tabs.forEach(destroyManagedTab);

  tabs = [];
  activeTabId = null;
}

function configureSessionSecurity(): void {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function configureWebContentsSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // The renderer should never be able to inject legacy <webview> tags anymore.
    contents.on('will-attach-webview', event => {
      event.preventDefault();
    });

    contents.on('will-navigate', (event, navigationUrl) => {
      if (isWindowContents(contents.id)) {
        if (!isTrustedAppUrl(navigationUrl)) {
          event.preventDefault();
        }
        return;
      }

      if (isTabContents(contents.id)) {
        if (!isHttpNavigationUrl(navigationUrl)) {
          event.preventDefault();
        }
        return;
      }

      if (!isHttpNavigationUrl(navigationUrl)) {
        event.preventDefault();
      }
    });
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL).catch(error => {
      console.error('[main] failed to load renderer dev URL', error);
    });
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html')).catch(error => {
      console.error('[main] failed to load renderer index file', error);
    });
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (tabs.length === 0) {
      createTab();
    } else {
      attachActiveTabView();
    }

    emitTabsState();
    emitBookmarksChanged();
    emitHistoryChanged();
    emitDownloadsChanged();
  });

  mainWindow.on('resize', () => {
    applyAttachedViewBounds();
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    destroyAllTabs();
    closeFloatWindow();
    closeMenuWindow();
    mainWindow = null;
  });
}

function createFloatWindow(): void {
  floatWindow = new BrowserWindow({
    width: 660,
    height: 64,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    const floatDevUrl = new URL('float.html', VITE_DEV_SERVER_URL).toString();
    floatWindow.loadURL(floatDevUrl).catch(error => {
      console.error('[main] failed to load float dev URL', error);
    });
  } else {
    floatWindow.loadFile(path.join(RENDERER_DIST, 'float.html')).catch(error => {
      console.error('[main] failed to load float renderer file', error);
    });
  }

  floatWindow.on('blur', () => {
    floatWindow?.hide();
  });

  floatWindow.on('closed', () => {
    floatWindow = null;
  });
}

function createMenuWindow(): void {
  menuWindowReady = false;
  menuWindow = new BrowserWindow({
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#1e1812',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    const menuDevUrl = new URL('menu.html', VITE_DEV_SERVER_URL).toString();
    menuWindow.loadURL(menuDevUrl).catch(error => {
      console.error('[main] failed to load menu dev URL', error);
    });
  } else {
    menuWindow.loadFile(path.join(RENDERER_DIST, 'menu.html')).catch(error => {
      console.error('[main] failed to load menu renderer file', error);
    });
  }

  menuWindow.webContents.on('did-finish-load', () => {
    menuWindowReady = true;
  });

  menuWindow.on('blur', () => {
    menuWindow?.hide();
  });

  menuWindow.on('closed', () => {
    menuWindow = null;
    menuWindowReady = false;
  });
}

ipcMain.handle(IPC_CHANNELS.TOGGLE_FLOAT, () => {
  if (!floatWindow || floatWindow.isDestroyed()) {
    createFloatWindow();
  }

  if (!floatWindow) {
    return;
  }

  if (floatWindow.isVisible()) {
    floatWindow.hide();
  } else {
    floatWindow.center();
    floatWindow.show();
    floatWindow.focus();
  }
});

ipcMain.handle(IPC_CHANNELS.MENU_SHOW, (_event, payload: unknown) => {
  const safePayload = parseMenuShowPayload(payload);
  if (!safePayload) {
    return;
  }

  if (!menuWindow || menuWindow.isDestroyed()) {
    createMenuWindow();
  }

  if (!menuWindow) {
    return;
  }

  const display = screen.getDisplayNearestPoint({
    x: safePayload.screenX,
    y: safePayload.screenY,
  });
  const { workArea } = display;

  const menuX = Math.max(
    workArea.x,
    Math.min(safePayload.screenX - MENU_WIDTH, workArea.x + workArea.width - MENU_WIDTH),
  );
  const menuY = Math.max(
    workArea.y,
    Math.min(safePayload.screenY + 4, workArea.y + workArea.height - MENU_HEIGHT),
  );

  menuWindow.setPosition(Math.round(menuX), Math.round(menuY));

  const initPayload = {
    isBookmarkBarVisible: safePayload.isBookmarkBarVisible,
    theme: safePayload.theme,
  };

  const sendAndShow = (): void => {
    menuWindow?.webContents.send(IPC_CHANNELS.MENU_INIT, initPayload);
    menuWindow?.show();
    menuWindow?.focus();
  };

  if (menuWindowReady) {
    sendAndShow();
  } else {
    menuWindow.webContents.once('did-finish-load', sendAndShow);
  }
});

ipcMain.handle(IPC_CHANNELS.MENU_ACTION, (_event, payload: unknown) => {
  const action = parseMenuActionPayload(payload);
  if (!action) {
    return;
  }

  menuWindow?.hide();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.MENU_ACTION_RELAY, action);
  }
});

ipcMain.handle(IPC_CHANNELS.FLOAT_NAVIGATE, (_event, payload: unknown) => {
  const safeUrl = parseFloatNavigatePayload(payload);
  if (!safeUrl) {
    return;
  }

  floatWindow?.hide();
  navigateActiveTab(safeUrl);
  mainWindow?.webContents.send(IPC_CHANNELS.OPEN_URL, safeUrl);
});

ipcMain.handle(IPC_CHANNELS.TAB_CREATE, (_event, payload: unknown) => {
  const safeUrl = parseTabCreatePayload(payload);
  const tab = createTab(safeUrl);
  return tab.id;
});

ipcMain.handle(IPC_CHANNELS.TAB_CLOSE, (_event, payload: unknown) => {
  const tabId = parseTabIdPayload(payload);
  if (!tabId) {
    return;
  }

  closeTab(tabId);
});

ipcMain.handle(IPC_CHANNELS.TAB_ACTIVATE, (_event, payload: unknown) => {
  const tabId = parseTabIdPayload(payload);
  if (!tabId) {
    return;
  }

  setActiveTab(tabId);
});

ipcMain.handle(IPC_CHANNELS.TAB_NAVIGATE, (_event, payload: unknown) => {
  const safeUrl = parseTabNavigatePayload(payload);
  if (!safeUrl) {
    return;
  }

  navigateActiveTab(safeUrl);
});

ipcMain.handle(IPC_CHANNELS.TAB_GO_BACK, () => {
  const activeTab = getActiveTab();
  const navigationHistory = activeTab?.view.webContents.navigationHistory;
  if (!activeTab || !navigationHistory || !navigationHistory.canGoBack()) {
    return;
  }

  navigationHistory.goBack();
});

ipcMain.handle(IPC_CHANNELS.TAB_GO_FORWARD, () => {
  const activeTab = getActiveTab();
  const navigationHistory = activeTab?.view.webContents.navigationHistory;
  if (!activeTab || !navigationHistory || !navigationHistory.canGoForward()) {
    return;
  }

  navigationHistory.goForward();
});

ipcMain.handle(IPC_CHANNELS.TAB_RELOAD, () => {
  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.url) {
    return;
  }

  activeTab.view.webContents.reload();
});

ipcMain.handle(IPC_CHANNELS.TAB_STOP, () => {
  getActiveTab()?.view.webContents.stop();
});

ipcMain.handle(IPC_CHANNELS.TAB_SET_BOUNDS, (_event, payload: unknown) => {
  const safeBounds = parseBrowserBoundsPayload(payload);
  if (!safeBounds) {
    return;
  }

  browserBounds = safeBounds;
  applyAttachedViewBounds();
});

ipcMain.handle(IPC_CHANNELS.TABS_GET_STATE, () => {
  return getTabsStateSnapshot();
});

ipcMain.handle(IPC_CHANNELS.BOOKMARKS_GET, () => {
  return getBookmarksSnapshot();
});

ipcMain.handle(IPC_CHANNELS.BOOKMARKS_TOGGLE_ACTIVE, () => {
  return toggleActiveBookmark();
});

ipcMain.handle(IPC_CHANNELS.BOOKMARKS_UPSERT, (_event, payload: unknown) => {
  const safePayload = parseBookmarkUpsertPayload(payload);
  if (!safePayload) {
    return getBookmarksSnapshot();
  }

  return upsertBookmark(safePayload);
});

ipcMain.handle(IPC_CHANNELS.BOOKMARKS_REMOVE, (_event, payload: unknown) => {
  const bookmarkId = parseBookmarkIdPayload(payload);
  if (!bookmarkId) {
    return getBookmarksSnapshot();
  }

  return removeBookmarkById(bookmarkId);
});

ipcMain.handle(IPC_CHANNELS.HISTORY_GET, () => {
  return getHistorySnapshot();
});

ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, () => {
  return clearHistory();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET, () => {
  return getDownloadsSnapshot();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET_DIRECTORY, () => {
  return getConfiguredDownloadsDirectory();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_SELECT_DIRECTORY, async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return getConfiguredDownloadsDirectory();
  }

  const currentDirectory = getConfiguredDownloadsDirectory();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select download folder',
    defaultPath: currentDirectory,
    properties: ['openDirectory', 'createDirectory'],
  });

  const selectedDirectory = result.filePaths[0];
  if (result.canceled || !selectedDirectory) {
    return currentDirectory;
  }

  return setConfiguredDownloadsDirectory(selectedDirectory);
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_PAUSE, (_event, payload: unknown) => {
  const downloadId = parseDownloadIdPayload(payload);
  if (!downloadId) {
    return;
  }

  const download = findManagedDownload(downloadId);
  if (!download?.item || download.item.isPaused()) {
    return;
  }

  download.item.pause();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_RESUME, (_event, payload: unknown) => {
  const downloadId = parseDownloadIdPayload(payload);
  if (!downloadId) {
    return;
  }

  const download = findManagedDownload(downloadId);
  if (!download?.item || !download.item.canResume()) {
    return;
  }

  download.item.resume();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CANCEL, (_event, payload: unknown) => {
  const downloadId = parseDownloadIdPayload(payload);
  if (!downloadId) {
    return;
  }

  const download = findManagedDownload(downloadId);
  if (!download?.item) {
    return;
  }

  download.item.cancel();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_REMOVE, (_event, payload: unknown) => {
  const downloadId = parseDownloadIdPayload(payload);
  if (!downloadId) {
    return;
  }

  managedDownloads = managedDownloads.filter(download => {
    return !(download.id === downloadId && !download.item);
  });

  emitDownloadsChanged();
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_OPEN_FILE, (_event, payload: unknown) => {
  const downloadId = parseDownloadIdPayload(payload);
  if (!downloadId) {
    return;
  }

  const download = findManagedDownload(downloadId);
  if (!download || download.state !== 'completed') {
    return;
  }

  void shell.openPath(download.savePath);
});

ipcMain.handle(IPC_CHANNELS.DOWNLOADS_SHOW_IN_FOLDER, (_event, payload: unknown) => {
  const downloadId = parseDownloadIdPayload(payload);
  if (!downloadId) {
    return;
  }

  const download = findManagedDownload(downloadId);
  if (!download) {
    return;
  }

  shell.showItemInFolder(download.savePath);
});

process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason);
});

app.whenReady().then(() => {
  configureSessionSecurity();
  configureWebContentsSecurity();
  registerDownloadSessionHandlers();

  try {
    storageLayer = initializeStorageLayer({
      userDataPath: app.getPath('userData'),
    });
  } catch (error) {
    console.error('[main] failed to initialize SQLite storage layer', error);
  }

  restoreTabsSession();

  createMainWindow();
  createFloatWindow();
  createMenuWindow();

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow();
    }

    if (!floatWindow || floatWindow.isDestroyed()) {
      createFloatWindow();
    }

    if (!menuWindow || menuWindow.isDestroyed()) {
      createMenuWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    destroyAllTabs();
    closeFloatWindow();
    closeMenuWindow();
    storageLayer?.close();
    storageLayer = null;
    app.quit();
  }
});

app.on('before-quit', () => {
  storageLayer?.close();
  storageLayer = null;
});
