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

export interface BookmarkSnapshot {
  id: number;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkUpsertPayload {
  url: string;
  title: string;
}

export interface HistorySnapshot {
  id: number;
  url: string;
  title: string;
  visitCount: number;
  lastVisitedAt: string;
}

export interface DownloadSnapshot {
  id: string;
  url: string;
  fileName: string;
  savePath: string;
  totalBytes: number;
  receivedBytes: number;
  percent: number;
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: string;
  updatedAt: string;
  speedBytesPerSecond: number;
  canResume: boolean;
}

export const MENU_ACTIONS = {
  NEW_TAB: 'new-tab',
  TOGGLE_BOOKMARKS: 'toggle-bookmarks',
  TOGGLE_HISTORY: 'toggle-history',
  OPEN_DOWNLOADS: 'open-downloads',
  TOGGLE_BOOKMARK_BAR: 'toggle-bookmark-bar',
  TOGGLE_THEME: 'toggle-theme',
  OPEN_FLOAT_SEARCH: 'open-float-search',
} as const;

export type MenuAction = (typeof MENU_ACTIONS)[keyof typeof MENU_ACTIONS];

export interface MenuShowPayload {
  screenX: number;
  screenY: number;
  isBookmarkBarVisible: boolean;
  theme: 'light' | 'dark';
}

export interface MenuInitPayload {
  isBookmarkBarVisible: boolean;
  theme: 'light' | 'dark';
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
  TAB_STOP: 'tab-stop',
  TAB_SET_BOUNDS: 'tab-set-bounds',
  TABS_GET_STATE: 'tabs-get-state',
  TABS_STATE_CHANGED: 'tabs-state-changed',
  BOOKMARKS_GET: 'bookmarks-get',
  BOOKMARKS_TOGGLE_ACTIVE: 'bookmarks-toggle-active',
  BOOKMARKS_UPSERT: 'bookmarks-upsert',
  BOOKMARKS_REMOVE: 'bookmarks-remove',
  BOOKMARKS_CHANGED: 'bookmarks-changed',
  HISTORY_GET: 'history-get',
  HISTORY_CLEAR: 'history-clear',
  HISTORY_CHANGED: 'history-changed',
  DOWNLOADS_GET: 'downloads-get',
  DOWNLOADS_CHANGED: 'downloads-changed',
  DOWNLOADS_GET_DIRECTORY: 'downloads-get-directory',
  DOWNLOADS_SELECT_DIRECTORY: 'downloads-select-directory',
  DOWNLOADS_PAUSE: 'downloads-pause',
  DOWNLOADS_RESUME: 'downloads-resume',
  DOWNLOADS_CANCEL: 'downloads-cancel',
  DOWNLOADS_REMOVE: 'downloads-remove',
  MENU_SHOW: 'menu-show',
  MENU_INIT: 'menu-init',
  MENU_ACTION: 'menu-action',
  MENU_ACTION_RELAY: 'menu-action-relay',
} as const;
