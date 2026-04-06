export {};

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

declare global {
  interface Window {
    orb: {
      toggleFloat: () => Promise<void>;
      floatNavigate: (url: string) => Promise<void>;
      onOpenUrl: (callback: (url: string) => void) => void;
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
      platform: string;
    };
  }
}
