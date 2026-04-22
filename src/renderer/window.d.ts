export {};

import type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
  HistorySnapshot,
  MenuAction,
  MenuInitPayload,
  MenuShowPayload,
  TabsStateSnapshot,
} from '../shared/ipc-contract';

declare global {
  interface Window {
    orb: {
      toggleFloat: () => Promise<void>;
      floatNavigate: (url: string) => Promise<void>;
      onOpenUrl: (callback: (url: string) => void) => () => void;
      createTab: (url?: string) => Promise<void>;
      closeTab: (tabId: number) => Promise<void>;
      activateTab: (tabId: number) => Promise<void>;
      navigateActiveTab: (input: string) => Promise<void>;
      goBack: () => Promise<void>;
      goForward: () => Promise<void>;
      reload: () => Promise<void>;
      stop: () => Promise<void>;
      setBrowserBounds: (bounds: BrowserBounds) => Promise<void>;
      getTabsState: () => Promise<TabsStateSnapshot>;
      onTabsStateChanged: (callback: (state: TabsStateSnapshot) => void) => () => void;
      getBookmarks: () => Promise<BookmarkSnapshot[]>;
      toggleActiveBookmark: () => Promise<BookmarkSnapshot[]>;
      upsertBookmark: (payload: BookmarkUpsertPayload) => Promise<BookmarkSnapshot[]>;
      removeBookmark: (bookmarkId: number) => Promise<BookmarkSnapshot[]>;
      onBookmarksChanged: (callback: (bookmarks: BookmarkSnapshot[]) => void) => () => void;
      getHistory: () => Promise<HistorySnapshot[]>;
      clearHistory: () => Promise<HistorySnapshot[]>;
      onHistoryChanged: (callback: (history: HistorySnapshot[]) => void) => () => void;
      showMenu: (payload: MenuShowPayload) => Promise<void>;
      menuAction: (action: MenuAction) => Promise<void>;
      onMenuAction: (callback: (action: MenuAction) => void) => () => void;
      onMenuInit: (callback: (state: MenuInitPayload) => void) => () => void;
      platform: string;
    };
  }
}
