import './styles/tailwind.css';
import type {
  BookmarkSnapshot,
  BrowserBounds,
  TabSnapshot,
  TabsStateSnapshot,
} from '../shared/ipc-contract';
import {
  requestNavigateActiveTab,
  requestTabClose,
  requestTabCloseIfActive,
  requestTabCreate,
} from './interaction';
import {
  getNextTheme,
  getThemeToggleMeta,
  normalizeTheme,
  ORB_THEME_STORAGE_KEY,
  resolveTheme,
} from './theme';

interface RendererState {
  tabs: TabSnapshot[];
  activeTabId: number | null;
  bookmarks: BookmarkSnapshot[];
  isBookmarkBarVisible: boolean;
  isBookmarkEditorOpen: boolean;
  isBookmarksSidebarOpen: boolean;
}

const ORB_BOOKMARK_BAR_VISIBLE_KEY = 'orb-bookmark-bar-visible';

const state: RendererState = {
  tabs: [],
  activeTabId: null,
  bookmarks: [],
  isBookmarkBarVisible: true,
  isBookmarkEditorOpen: false,
  isBookmarksSidebarOpen: false,
};

const tabsContainer = document.getElementById('tabs') as HTMLDivElement;
const bookmarkBar = document.getElementById('bookmark-bar') as HTMLDivElement;
const bookmarkBarList = document.getElementById('bookmark-bar-list') as HTMLDivElement;
const bookmarkBarEmpty = document.getElementById('bookmark-bar-empty') as HTMLSpanElement;
const bookmarkEditor = document.getElementById('bookmark-editor') as HTMLDivElement;
const bookmarkEditorTitle = document.getElementById('bookmark-editor-title') as HTMLInputElement;
const bookmarkEditorUrl = document.getElementById('bookmark-editor-url') as HTMLInputElement;
const bookmarkEditorSave = document.getElementById('bookmark-editor-save') as HTMLButtonElement;
const bookmarkEditorCancel = document.getElementById('bookmark-editor-cancel') as HTMLButtonElement;
const bookmarksSidebar = document.getElementById('bookmarks-sidebar') as HTMLDivElement;
const bookmarksList = document.getElementById('bookmarks-list') as HTMLUListElement;
const bookmarksEmpty = document.getElementById('bookmarks-empty') as HTMLParagraphElement;
const browserArea = document.getElementById('browser-area') as HTMLDivElement;
const newTabPage = document.getElementById('new-tab-page') as HTMLDivElement;
const addressBar = document.getElementById('address-bar') as HTMLInputElement;
const newTabSearch = document.getElementById('new-tab-search') as HTMLInputElement;
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
const btnReload = document.getElementById('btn-reload') as HTMLButtonElement;
const btnTheme = document.getElementById('btn-theme') as HTMLButtonElement;
const btnBookmark = document.getElementById('btn-bookmark') as HTMLButtonElement;
const btnBookmarkBar = document.getElementById('btn-bookmark-bar') as HTMLButtonElement;
const btnBookmarks = document.getElementById('btn-bookmarks') as HTMLButtonElement;
const btnFloat = document.getElementById('btn-float') as HTMLButtonElement;
const btnNewTab = document.getElementById('btn-new-tab') as HTMLButtonElement;
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

let unsubscribeOpenUrl: (() => void) | null = null;
let unsubscribeTabsState: (() => void) | null = null;
let unsubscribeBookmarks: (() => void) | null = null;

function getStoredBookmarkBarVisibility(): boolean {
  try {
    const storedValue = window.localStorage.getItem(ORB_BOOKMARK_BAR_VISIBLE_KEY);
    if (storedValue === '0') {
      return false;
    }

    if (storedValue === '1') {
      return true;
    }
  } catch {
    // Ignore localStorage read failures in restricted environments.
  }

  return true;
}

function setStoredBookmarkBarVisibility(isVisible: boolean): void {
  try {
    window.localStorage.setItem(ORB_BOOKMARK_BAR_VISIBLE_KEY, isVisible ? '1' : '0');
  } catch {
    // Ignore localStorage write failures in restricted environments.
  }
}

state.isBookmarkBarVisible = getStoredBookmarkBarVisibility();

function getStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(ORB_THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredTheme(theme: string): void {
  try {
    window.localStorage.setItem(ORB_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage write failures in restricted environments.
  }
}

function getCurrentTheme(): 'light' | 'dark' {
  return normalizeTheme(document.documentElement.dataset.theme ?? null) ?? 'dark';
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;

  const themeToggleMeta = getThemeToggleMeta(theme);
  btnTheme.textContent = themeToggleMeta.icon;
  btnTheme.title = themeToggleMeta.title;
}

function syncThemeFromEnvironment(): void {
  const resolvedTheme = resolveTheme(getStoredTheme(), themeMediaQuery.matches);
  applyTheme(resolvedTheme);
}

const onThemePreferenceChanged = (): void => {
  if (!normalizeTheme(getStoredTheme())) {
    syncThemeFromEnvironment();
  }
};

syncThemeFromEnvironment();
themeMediaQuery.addEventListener('change', onThemePreferenceChanged);

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getActiveTab(): TabSnapshot | undefined {
  return state.tabs.find(tab => tab.id === state.activeTabId);
}

function getActiveBookmark(): BookmarkSnapshot | undefined {
  const activeTab = getActiveTab();
  if (!activeTab?.url) {
    return undefined;
  }

  return state.bookmarks.find(bookmark => bookmark.url === activeTab.url);
}

function setBookmarkEditorOpen(isOpen: boolean): void {
  if (state.isBookmarkEditorOpen === isOpen) {
    return;
  }

  state.isBookmarkEditorOpen = isOpen;
  render();
  syncBrowserBounds();
}

function closeBookmarkEditor(): void {
  setBookmarkEditorOpen(false);
}

function openBookmarkEditor(defaultTitle: string, defaultUrl: string): void {
  bookmarkEditorTitle.value = defaultTitle;
  bookmarkEditorUrl.value = defaultUrl;
  setBookmarkEditorOpen(true);
  bookmarkEditorTitle.focus();
  bookmarkEditorTitle.select();
}

function saveBookmarkFromEditor(): void {
  const title = bookmarkEditorTitle.value.trim();
  const url = bookmarkEditorUrl.value.trim();
  if (!url) {
    bookmarkEditorUrl.focus();
    return;
  }

  void window.orb
    .upsertBookmark({
      title,
      url,
    })
    .then(applyBookmarks);

  closeBookmarkEditor();
}

function triggerBookmarkAction(): void {
  const activeTab = getActiveTab();
  if (!activeTab?.url) {
    return;
  }

  const activeBookmark = getActiveBookmark();
  if (activeBookmark) {
    closeBookmarkEditor();
    void window.orb.removeBookmark(activeBookmark.id).then(applyBookmarks);
    return;
  }

  openBookmarkEditor(activeTab.title || activeTab.url, activeTab.url);
}

function getBookmarkFaviconUrl(rawUrl: string): string {
  try {
    const parsedUrl = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(parsedUrl.origin)}`;
  } catch {
    return '';
  }
}

function syncBrowserBounds(): void {
  // BrowserView is owned by main, so renderer sends browser area coordinates over IPC.
  const rect = browserArea.getBoundingClientRect();
  const bounds: BrowserBounds = {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };

  void window.orb.setBrowserBounds(bounds);
}

function renderTabs(): void {
  tabsContainer.innerHTML = '';

  state.tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab${tab.id === state.activeTabId ? ' active' : ''}`;
    tabElement.dataset.id = String(tab.id);
    tabElement.innerHTML = `
      <span class="tab-title">${escapeHtml(tab.title || 'New Tab')}</span>
      <button class="tab-close" data-close-id="${tab.id}">X</button>
    `;

    tabsContainer.appendChild(tabElement);
  });
}

function renderNavigation(): void {
  const activeTab = getActiveTab();

  addressBar.value = activeTab?.url ?? '';
  btnBack.disabled = !(activeTab && activeTab.canGoBack);
  btnForward.disabled = !(activeTab && activeTab.canGoForward);

  // Tabs without a URL are treated as "new tab" state by the main process.
  newTabPage.style.display = activeTab?.url ? 'none' : 'flex';
}

function renderBookmarkControls(): void {
  const activeTab = getActiveTab();
  const activeBookmark = getActiveBookmark();

  btnBookmark.disabled = !activeTab?.url;
  btnBookmark.textContent = activeBookmark ? '★' : '☆';
  btnBookmark.title = activeBookmark
    ? 'Remove bookmark from this page (Cmd/Ctrl+D)'
    : 'Save bookmark for this page (Cmd/Ctrl+D)';

  btnBookmarkBar.textContent = state.isBookmarkBarVisible ? '▤' : '▥';
  btnBookmarkBar.title = state.isBookmarkBarVisible
    ? 'Hide bookmarks bar (Cmd/Ctrl+Shift+B)'
    : 'Show bookmarks bar (Cmd/Ctrl+Shift+B)';

  btnBookmarks.textContent = state.isBookmarksSidebarOpen ? '×' : '☰';
  btnBookmarks.title = state.isBookmarksSidebarOpen
    ? 'Hide bookmarks sidebar'
    : 'Show bookmarks sidebar';
}

function renderBookmarkEditor(): void {
  bookmarkEditor.classList.toggle('hidden', !state.isBookmarkEditorOpen);
  bookmarkEditor.classList.toggle('flex', state.isBookmarkEditorOpen);

  const canSave = bookmarkEditorUrl.value.trim().length > 0;
  bookmarkEditorSave.disabled = !canSave;
}

function renderBookmarkBar(): void {
  bookmarkBar.classList.toggle('hidden', !state.isBookmarkBarVisible);

  bookmarkBarList.innerHTML = '';

  const hasBookmarks = state.bookmarks.length > 0;
  bookmarkBarEmpty.style.display = hasBookmarks ? 'none' : 'inline';

  if (!hasBookmarks) {
    return;
  }

  state.bookmarks.forEach(bookmark => {
    const faviconUrl = getBookmarkFaviconUrl(bookmark.url);
    const faviconMarkup = faviconUrl
      ? `<img src="${escapeHtml(faviconUrl)}" alt="" referrerpolicy="no-referrer" class="h-4 w-4 shrink-0 rounded-sm bg-white/80" />`
      : '<span class="h-4 w-4 shrink-0 rounded-sm bg-orb-surface-2"></span>';

    const bookmarkChip = document.createElement('button');
    bookmarkChip.className =
      'flex h-7 max-w-[220px] items-center gap-1.5 rounded-orb border border-orb-border bg-orb-bg px-2 text-left transition hover:bg-orb-surface-2';
    bookmarkChip.setAttribute('data-bookmark-bar-open-id', String(bookmark.id));
    bookmarkChip.title = bookmark.url;
    bookmarkChip.innerHTML = `
      ${faviconMarkup}
      <span class="max-w-[170px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-orb-text">${escapeHtml(bookmark.title || bookmark.url)}</span>
    `;

    bookmarkBarList.appendChild(bookmarkChip);
  });
}

function renderBookmarksSidebar(): void {
  bookmarksSidebar.classList.toggle('hidden', !state.isBookmarksSidebarOpen);

  bookmarksList.innerHTML = '';
  const hasBookmarks = state.bookmarks.length > 0;
  bookmarksEmpty.style.display = hasBookmarks ? 'none' : 'block';

  if (!hasBookmarks) {
    return;
  }

  state.bookmarks.forEach(bookmark => {
    const bookmarkElement = document.createElement('li');
    bookmarkElement.className = 'mb-1 last:mb-0';
    bookmarkElement.innerHTML = `
      <div class="flex items-start gap-1 rounded-orb border border-orb-border bg-orb-bg px-2 py-1.5">
        <button class="flex min-w-0 flex-1 flex-col items-start bg-transparent text-left" data-bookmark-open-id="${bookmark.id}" title="${escapeHtml(bookmark.url)}">
          <span class="w-full overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-orb-text">${escapeHtml(bookmark.title || bookmark.url)}</span>
          <span class="w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-orb-text-dim">${escapeHtml(bookmark.url)}</span>
        </button>
        <button class="h-6 w-6 shrink-0 rounded border-0 bg-transparent text-orb-text-dim transition hover:bg-orb-surface-2 hover:text-orb-text" data-bookmark-remove-id="${bookmark.id}" title="Remove bookmark">×</button>
      </div>
    `;

    bookmarksList.appendChild(bookmarkElement);
  });
}

function render(): void {
  renderTabs();
  renderNavigation();
  renderBookmarkControls();
  renderBookmarkBar();
  renderBookmarkEditor();
  renderBookmarksSidebar();
}

function applyState(nextState: TabsStateSnapshot): void {
  state.tabs = nextState.tabs;
  state.activeTabId = nextState.activeTabId;
  render();
  syncBrowserBounds();
}

function applyBookmarks(nextBookmarks: BookmarkSnapshot[]): void {
  state.bookmarks = nextBookmarks;
  render();
}

function setBookmarksSidebarOpen(isOpen: boolean): void {
  if (state.isBookmarksSidebarOpen === isOpen) {
    return;
  }

  state.isBookmarksSidebarOpen = isOpen;
  render();
  syncBrowserBounds();
}

function toggleBookmarksSidebar(): void {
  setBookmarksSidebarOpen(!state.isBookmarksSidebarOpen);
}

function setBookmarkBarVisible(isVisible: boolean): void {
  if (state.isBookmarkBarVisible === isVisible) {
    return;
  }

  state.isBookmarkBarVisible = isVisible;
  setStoredBookmarkBarVisibility(isVisible);
  render();
  syncBrowserBounds();
}

function toggleBookmarkBar(): void {
  setBookmarkBarVisible(!state.isBookmarkBarVisible);
}

function navigate(input: string): void {
  const value = requestNavigateActiveTab(window.orb, input);
  if (!value) {
    return;
  }

  closeBookmarkEditor();

  // Main process normalizes this to URL/search and performs navigation safely.
  newTabSearch.value = '';
}

function activateTab(tabId: number): void {
  void window.orb.activateTab(tabId);
}

function closeTab(tabId: number): void {
  requestTabClose(window.orb, tabId);
}

btnNewTab.addEventListener('click', () => {
  requestTabCreate(window.orb);
});

btnBack.addEventListener('click', () => {
  void window.orb.goBack();
});

btnForward.addEventListener('click', () => {
  void window.orb.goForward();
});

btnReload.addEventListener('click', () => {
  void window.orb.reload();
});

btnTheme.addEventListener('click', () => {
  const nextTheme = getNextTheme(getCurrentTheme());
  setStoredTheme(nextTheme);
  applyTheme(nextTheme);
});

btnBookmark.addEventListener('click', () => {
  triggerBookmarkAction();
});

btnBookmarkBar.addEventListener('click', () => {
  toggleBookmarkBar();
});

btnBookmarks.addEventListener('click', () => {
  toggleBookmarksSidebar();
});

btnFloat.addEventListener('click', () => {
  void window.orb.toggleFloat();
});

bookmarkEditorSave.addEventListener('click', () => {
  saveBookmarkFromEditor();
});

bookmarkEditorCancel.addEventListener('click', () => {
  closeBookmarkEditor();
});

bookmarkEditorTitle.addEventListener('input', () => {
  renderBookmarkEditor();
});

bookmarkEditorUrl.addEventListener('input', () => {
  renderBookmarkEditor();
});

bookmarkEditorTitle.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveBookmarkFromEditor();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeBookmarkEditor();
  }
});

bookmarkEditorUrl.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveBookmarkFromEditor();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeBookmarkEditor();
  }
});

addressBar.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    navigate(addressBar.value);
  }
});

newTabSearch.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    navigate(newTabSearch.value);
  }
});

tabsContainer.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const closeId = target.getAttribute('data-close-id');
  if (closeId) {
    closeTab(Number(closeId));
    return;
  }

  const tabElement = target.closest('.tab');
  if (!(tabElement instanceof HTMLElement)) {
    return;
  }

  const tabIdText = tabElement.dataset.id;
  if (!tabIdText) {
    return;
  }

  activateTab(Number(tabIdText));
});

bookmarksList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const removeTarget = target.closest<HTMLElement>('[data-bookmark-remove-id]');
  if (removeTarget) {
    const bookmarkId = Number(removeTarget.getAttribute('data-bookmark-remove-id'));
    if (Number.isInteger(bookmarkId) && bookmarkId > 0) {
      void window.orb.removeBookmark(bookmarkId).then(applyBookmarks);
    }
    return;
  }

  const openTarget = target.closest<HTMLElement>('[data-bookmark-open-id]');
  if (!openTarget) {
    return;
  }

  const bookmarkId = Number(openTarget.getAttribute('data-bookmark-open-id'));
  if (!Number.isInteger(bookmarkId) || bookmarkId <= 0) {
    return;
  }

  const bookmark = state.bookmarks.find(entry => entry.id === bookmarkId);
  if (!bookmark) {
    return;
  }

  navigate(bookmark.url);
});

bookmarkBarList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const openTarget = target.closest<HTMLElement>('[data-bookmark-bar-open-id]');
  if (!openTarget) {
    return;
  }

  const bookmarkId = Number(openTarget.getAttribute('data-bookmark-bar-open-id'));
  if (!Number.isInteger(bookmarkId) || bookmarkId <= 0) {
    return;
  }

  const bookmark = state.bookmarks.find(entry => entry.id === bookmarkId);
  if (!bookmark) {
    return;
  }

  navigate(bookmark.url);
});

unsubscribeOpenUrl = window.orb.onOpenUrl(url => {
  // Float window already triggers main-process navigation; we mirror address text here.
  addressBar.value = url;
});

unsubscribeTabsState = window.orb.onTabsStateChanged(nextState => {
  applyState(nextState);
});

unsubscribeBookmarks = window.orb.onBookmarksChanged(nextBookmarks => {
  applyBookmarks(nextBookmarks);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.isBookmarkEditorOpen) {
    event.preventDefault();
    closeBookmarkEditor();
    return;
  }

  const mod = event.metaKey || event.ctrlKey;

  if (mod && event.key.toLowerCase() === 't') {
    event.preventDefault();
    requestTabCreate(window.orb);
    return;
  }

  if (mod && event.key.toLowerCase() === 'w') {
    event.preventDefault();
    requestTabCloseIfActive(window.orb, state.activeTabId);
    return;
  }

  if (mod && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    addressBar.focus();
    addressBar.select();
    return;
  }

  if (mod && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    void window.orb.reload();
    return;
  }

  if (mod && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    triggerBookmarkAction();
    return;
  }

  if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    toggleBookmarkBar();
    return;
  }

  if (mod && event.shiftKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    void window.orb.toggleFloat();
  }
});

window.addEventListener('resize', syncBrowserBounds);
new ResizeObserver(syncBrowserBounds).observe(browserArea);

window.addEventListener('beforeunload', () => {
  themeMediaQuery.removeEventListener('change', onThemePreferenceChanged);

  unsubscribeOpenUrl?.();
  unsubscribeOpenUrl = null;

  unsubscribeTabsState?.();
  unsubscribeTabsState = null;

  unsubscribeBookmarks?.();
  unsubscribeBookmarks = null;
});

window.orb.getBookmarks().then(initialBookmarks => {
  applyBookmarks(initialBookmarks);
});

window.orb.getTabsState().then(initialState => {
  applyState(initialState);
  if (initialState.tabs.length === 0) {
    requestTabCreate(window.orb);
  }
});
