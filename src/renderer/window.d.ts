export {};

import type {
  BookmarkSnapshot,
  BookmarkUpsertPayload,
  BrowserBounds,
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
      setBrowserBounds: (bounds: BrowserBounds) => Promise<void>;
      getTabsState: () => Promise<TabsStateSnapshot>;
      onTabsStateChanged: (callback: (state: TabsStateSnapshot) => void) => () => void;
      getBookmarks: () => Promise<BookmarkSnapshot[]>;
      toggleActiveBookmark: () => Promise<BookmarkSnapshot[]>;
      upsertBookmark: (payload: BookmarkUpsertPayload) => Promise<BookmarkSnapshot[]>;
      removeBookmark: (bookmarkId: number) => Promise<BookmarkSnapshot[]>;
      onBookmarksChanged: (callback: (bookmarks: BookmarkSnapshot[]) => void) => () => void;
      platform: string;
    };
  }
}
