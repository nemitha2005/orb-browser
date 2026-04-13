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
  BOOKMARKS_GET: 'bookmarks-get',
  BOOKMARKS_TOGGLE_ACTIVE: 'bookmarks-toggle-active',
  BOOKMARKS_UPSERT: 'bookmarks-upsert',
  BOOKMARKS_REMOVE: 'bookmarks-remove',
  BOOKMARKS_CHANGED: 'bookmarks-changed',
} as const;
