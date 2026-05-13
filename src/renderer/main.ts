import './styles/tailwind.css';
import type {
  BookmarkSnapshot,
  BrowserBounds,
  DownloadSnapshot,
  HistorySnapshot,
  MenuAction,
  TabSnapshot,
  TabsStateSnapshot,
} from '../shared/ipc-contract';
import { MENU_ACTIONS } from '../shared/ipc-contract';
import {
  requestNavigateActiveTab,
  requestTabClose,
  requestTabCloseIfActive,
  requestTabCreate,
} from './interaction';
import { ICONS } from './icons';
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
  history: HistorySnapshot[];
  downloads: DownloadSnapshot[];
  downloadDirectory: string;
  isBookmarkBarVisible: boolean;
  isBookmarkEditorOpen: boolean;
  isBookmarksSidebarOpen: boolean;
  isHistorySidebarOpen: boolean;
  fullPageView: 'history' | 'bookmarks' | 'downloads' | null;
}

const ORB_BOOKMARK_BAR_VISIBLE_KEY = 'orb-bookmark-bar-visible';

const state: RendererState = {
  tabs: [],
  activeTabId: null,
  bookmarks: [],
  history: [],
  downloads: [],
  downloadDirectory: '',
  isBookmarkBarVisible: true,
  isBookmarkEditorOpen: false,
  isBookmarksSidebarOpen: false,
  isHistorySidebarOpen: false,
  fullPageView: null,
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
const btnBookmarksClose = document.getElementById('btn-bookmarks-close') as HTMLButtonElement;
const btnBookmarksDetailed = document.getElementById('btn-bookmarks-detailed') as HTMLButtonElement;
const historySidebar = document.getElementById('history-sidebar') as HTMLDivElement;
const historyList = document.getElementById('history-list') as HTMLUListElement;
const historyEmpty = document.getElementById('history-empty') as HTMLParagraphElement;
const btnHistoryClose = document.getElementById('btn-history-close') as HTMLButtonElement;
const btnHistoryDetailed = document.getElementById('btn-history-detailed') as HTMLButtonElement;
const browserArea = document.getElementById('browser-area') as HTMLDivElement;
const fullPageView = document.getElementById('full-page-view') as HTMLDivElement;
const fullPageTitle = document.getElementById('full-page-title') as HTMLHeadingElement;
const btnFullPageClose = document.getElementById('btn-full-page-close') as HTMLButtonElement;
const fullPageBookmarks = document.getElementById('full-page-bookmarks') as HTMLDivElement;
const fullPageBookmarksList = document.getElementById('full-page-bookmarks-list') as HTMLDivElement;
const fullPageBookmarksEmpty = document.getElementById('full-page-bookmarks-empty') as HTMLParagraphElement;
const fullPageHistory = document.getElementById('full-page-history') as HTMLDivElement;
const fullPageHistoryList = document.getElementById('full-page-history-list') as HTMLUListElement;
const fullPageHistoryEmpty = document.getElementById('full-page-history-empty') as HTMLParagraphElement;
const btnFullPageHistoryClear = document.getElementById('btn-full-page-history-clear') as HTMLButtonElement;
const fullPageDownloads = document.getElementById('full-page-downloads') as HTMLDivElement;
const fullPageDownloadsList = document.getElementById('full-page-downloads-list') as HTMLDivElement;
const fullPageDownloadsEmpty = document.getElementById('full-page-downloads-empty') as HTMLParagraphElement;
const downloadDirectoryValue = document.getElementById('download-directory-value') as HTMLSpanElement;
const btnDownloadDirectorySelect = document.getElementById('btn-download-directory-select') as HTMLButtonElement;
const newTabPage = document.getElementById('new-tab-page') as HTMLDivElement;
const addressBar = document.getElementById('address-bar') as HTMLInputElement;
const newTabSearch = document.getElementById('new-tab-search') as HTMLInputElement;
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
const btnReload = document.getElementById('btn-reload') as HTMLButtonElement;
const btnBookmark = document.getElementById('btn-bookmark') as HTMLButtonElement;
const downloadsIndicatorShell = document.getElementById(
  'downloads-indicator-shell',
) as HTMLDivElement;
const btnDownloadsIndicator = document.getElementById('btn-downloads-indicator') as HTMLButtonElement;
const downloadsIndicatorCount = document.getElementById('downloads-indicator-count') as HTMLSpanElement;
const downloadsIndicatorProgressTrack = document.getElementById(
  'downloads-indicator-progress-track',
) as HTMLSpanElement;
const downloadsIndicatorProgress = document.getElementById(
  'downloads-indicator-progress',
) as HTMLSpanElement;
const btnHistoryClear = document.getElementById('btn-history-clear') as HTMLButtonElement;
const btnFloat = document.getElementById('btn-float') as HTMLButtonElement;
const btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;
const btnNewTab = document.getElementById('btn-new-tab') as HTMLButtonElement;
const loadingBar = document.getElementById('loading-bar') as HTMLDivElement;
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// Set static SVG icons that never change
btnBack.innerHTML = ICONS.back;
btnForward.innerHTML = ICONS.forward;
btnReload.innerHTML = ICONS.reload;
btnDownloadsIndicator.insertAdjacentHTML('afterbegin', ICONS.downloads);
btnFloat.innerHTML = ICONS.float;
btnMenu.innerHTML = ICONS.menu;
btnNewTab.innerHTML = ICONS.plus;

let hasUnseenDownloads = false;
let knownDownloadIds = new Set<string>();

// Per-tab internal route – each tab keeps its own orb:// page state
const tabInternalRoutes = new Map<number, 'history' | 'bookmarks' | 'downloads'>();

// Route to bind to the next newly-activated tab (set before createTab(), consumed in applyState)
let pendingInternalRoute: 'history' | 'bookmarks' | 'downloads' | null = null;

let unsubscribeOpenUrl: (() => void) | null = null;
let unsubscribeTabsState: (() => void) | null = null;
let unsubscribeBookmarks: (() => void) | null = null;
let unsubscribeHistory: (() => void) | null = null;
let unsubscribeDownloads: (() => void) | null = null;
let unsubscribeMenuAction: (() => void) | null = null;

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
  btnFloat.title = `Floating search (Ctrl+Shift+O) — ${themeToggleMeta.title}`;
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

function getSiteFaviconUrl(rawUrl: string): string {
  try {
    const parsedUrl = new URL(rawUrl);
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(parsedUrl.origin)}`;
  } catch {
    return '';
  }
}

function formatHistoryTimestamp(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown time';
  }

  return parsedDate.toLocaleString();
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function getDownloadStateLabel(stateValue: DownloadSnapshot['state']): string {
  switch (stateValue) {
    case 'progressing': return 'downloading';
    case 'paused':      return 'paused';
    case 'completed':   return 'done';
    case 'cancelled':   return 'cancelled';
    case 'interrupted': return 'interrupted';
    default:            return 'unknown';
  }
}

function getDownloadBadgeClass(stateValue: DownloadSnapshot['state']): string {
  switch (stateValue) {
    case 'progressing': return 'orb-badge orb-badge-active';
    case 'paused':      return 'orb-badge orb-badge-paused';
    case 'completed':   return 'orb-badge orb-badge-done';
    case 'cancelled':
    case 'interrupted': return 'orb-badge orb-badge-error';
    default:            return 'orb-badge orb-badge-error';
  }
}

function getActiveDownloads(): DownloadSnapshot[] {
  return state.downloads.filter(download => {
    return download.state === 'progressing' || download.state === 'paused';
  });
}

function requestNewTab(): void {
  requestTabCreate(window.orb);
}

function renderDownloadsIndicator(): void {
  const activeDownloads = getActiveDownloads();
  const activeCount = activeDownloads.length;
  const hasAnyDownloads = state.downloads.length > 0;

  // Keep visible as long as there are any downloads (like Chrome)
  downloadsIndicatorShell.classList.toggle('hidden', !hasAnyDownloads);

  downloadsIndicatorCount.textContent = String(activeCount);
  downloadsIndicatorCount.classList.toggle('hidden', activeCount === 0);
  btnDownloadsIndicator.classList.toggle('text-orb-accent', activeCount > 0 || hasUnseenDownloads);
  btnDownloadsIndicator.classList.toggle(
    'text-orb-text-dim',
    activeCount === 0 && !hasUnseenDownloads,
  );

  const shouldShowProgress = activeCount > 0;
  let aggregateProgress = 0;
  if (activeCount > 0) {
    const bytesTotals = activeDownloads.reduce(
      (accumulator, download) => {
        return {
          receivedBytes: accumulator.receivedBytes + download.receivedBytes,
          totalBytes: accumulator.totalBytes + Math.max(0, download.totalBytes),
        };
      },
      { receivedBytes: 0, totalBytes: 0 },
    );

    if (bytesTotals.totalBytes > 0) {
      aggregateProgress = Math.round((bytesTotals.receivedBytes / bytesTotals.totalBytes) * 100);
    } else {
      const percentTotal = activeDownloads.reduce((accumulator, download) => {
        return accumulator + download.percent;
      }, 0);
      aggregateProgress = Math.round(percentTotal / activeCount);
    }
  }

  downloadsIndicatorProgressTrack.classList.toggle('hidden', !shouldShowProgress);
  downloadsIndicatorProgress.style.width = `${Math.max(0, Math.min(100, aggregateProgress))}%`;
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

  if (state.fullPageView) {
    bounds.y = Math.max(0, Math.round(rect.bottom - 1));
    bounds.width = 1;
    bounds.height = 1;
  }

  void window.orb.setBrowserBounds(bounds);
}

function resolveInternalRoute(input: string): 'history' | 'bookmarks' | 'downloads' | null {
  const normalized = input.trim().toLowerCase();

  if (normalized === 'orb/history' || normalized === 'orb://history') {
    return 'history';
  }

  if (normalized === 'orb/bookmarks' || normalized === 'orb://bookmarks') {
    return 'bookmarks';
  }

  if (normalized === 'orb/downloads' || normalized === 'orb://downloads') {
    return 'downloads';
  }

  return null;
}

function updateTabCompactMode(): void {
  if (state.tabs.length === 0) {
    tabsContainer.classList.remove('compact');
    return;
  }
  const perTabPx = tabsContainer.offsetWidth / state.tabs.length;
  tabsContainer.classList.toggle('compact', perTabPx < 72);
}

const INTERNAL_ROUTE_TITLES: Record<'history' | 'bookmarks' | 'downloads', string> = {
  history: 'History',
  bookmarks: 'Bookmarks',
  downloads: 'Downloads',
};

function renderTabs(): void {
  tabsContainer.innerHTML = '';

  state.tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `tab${tab.id === state.activeTabId ? ' active' : ''}`;
    tabElement.dataset.id = String(tab.id);

    // Internal-page tabs get a friendly title instead of the BrowserView title
    const internalRoute = tabInternalRoutes.get(tab.id);
    const displayTitle = internalRoute
      ? INTERNAL_ROUTE_TITLES[internalRoute]
      : (tab.title || 'New Tab');

    const faviconUrl = !internalRoute && tab.url ? getSiteFaviconUrl(tab.url) : '';
    const iconContent = faviconUrl
      ? `<img class="tab-fav" src="${escapeHtml(faviconUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`
      : `<span class="tab-fav-ph"></span>`;

    tabElement.innerHTML = `
      <div class="tab-ic">
        ${iconContent}
        <button class="tab-close-cpt" data-close-id="${tab.id}" title="Close tab">✕</button>
      </div>
      <span class="tab-title">${escapeHtml(displayTitle)}</span>
      <button class="tab-close-std" data-close-id="${tab.id}" title="Close tab">✕</button>
    `;

    tabsContainer.appendChild(tabElement);
  });

  updateTabCompactMode();
}

function renderNavigation(): void {
  const activeTab = getActiveTab();
  const isLoading = activeTab?.isLoading ?? false;

  if (state.fullPageView === 'history') {
    addressBar.value = 'orb/history';
  } else if (state.fullPageView === 'bookmarks') {
    addressBar.value = 'orb/bookmarks';
  } else if (state.fullPageView === 'downloads') {
    addressBar.value = 'orb/downloads';
  } else {
    addressBar.value = activeTab?.url ?? '';
  }

  btnBack.disabled = !(activeTab && activeTab.canGoBack);
  btnForward.disabled = !(activeTab && activeTab.canGoForward);

  if (isLoading) {
    btnReload.innerHTML = ICONS.stop;
    btnReload.title = 'Stop loading';
    btnReload.disabled = false;
  } else {
    btnReload.innerHTML = ICONS.reload;
    btnReload.title = 'Reload';
    btnReload.disabled = !activeTab?.url;
  }

  loadingBar.classList.toggle('hidden', !isLoading);

  // Tabs without a URL are treated as "new tab" state by the main process.
  newTabPage.style.display = !state.fullPageView && activeTab?.url ? 'none' : 'flex';
}

function renderBookmarkControls(): void {
  const activeTab = getActiveTab();
  const activeBookmark = getActiveBookmark();

  btnBookmark.disabled = !activeTab?.url;
  btnBookmark.innerHTML = activeBookmark ? ICONS.starFilled : ICONS.starEmpty;
  btnBookmark.classList.toggle('text-orb-accent', !!activeBookmark);
  btnBookmark.classList.toggle('text-orb-text-dim', !activeBookmark);
  btnBookmark.title = activeBookmark
    ? 'Remove bookmark from this page (Ctrl+D)'
    : 'Save bookmark for this page (Ctrl+D)';
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
    const faviconUrl = getSiteFaviconUrl(bookmark.url);
    const faviconMarkup = faviconUrl
      ? `<img src="${escapeHtml(faviconUrl)}" alt="" referrerpolicy="no-referrer" class="h-4 w-4 shrink-0 rounded-sm bg-white/80" />`
      : '<span class="h-4 w-4 shrink-0 rounded-sm bg-orb-surface-2"></span>';

    const bookmarkChip = document.createElement('button');
    bookmarkChip.className =
      'flex h-6 max-w-[200px] items-center gap-1.5 rounded-orb border border-orb-border bg-orb-bg px-2 text-left transition hover:border-orb-border-hi hover:bg-orb-surface-2';
    bookmarkChip.setAttribute('data-bookmark-bar-open-id', String(bookmark.id));
    bookmarkChip.title = bookmark.url;
    bookmarkChip.innerHTML = `
      ${faviconMarkup}
      <span class="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-orb-text">${escapeHtml(bookmark.title || bookmark.url)}</span>
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
      <div class="flex items-start gap-1 rounded-orb border border-orb-border bg-orb-bg px-2 py-1.5 transition hover:border-orb-border-hi hover:bg-orb-surface-2">
        <button class="flex min-w-0 flex-1 flex-col items-start bg-transparent text-left" data-bookmark-open-id="${bookmark.id}" title="${escapeHtml(bookmark.url)}">
          <span class="w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-orb-text">${escapeHtml(bookmark.title || bookmark.url)}</span>
          <span class="w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-orb-text-dim">${escapeHtml(bookmark.url)}</span>
        </button>
        <button class="h-6 w-6 shrink-0 rounded border-0 bg-transparent font-mono text-orb-text-dim transition hover:bg-orb-surface-2 hover:text-orb-accent" data-bookmark-remove-id="${bookmark.id}" title="Remove bookmark">×</button>
      </div>
    `;

    bookmarksList.appendChild(bookmarkElement);
  });
}

function renderHistorySidebar(): void {
  historySidebar.classList.toggle('hidden', !state.isHistorySidebarOpen);

  historyList.innerHTML = '';
  const hasHistory = state.history.length > 0;
  historyEmpty.style.display = hasHistory ? 'none' : 'block';
  btnHistoryClear.disabled = !hasHistory;

  if (!hasHistory) {
    return;
  }

  state.history.forEach(historyEntry => {
    const faviconUrl = getSiteFaviconUrl(historyEntry.url);
    const historyElement = document.createElement('li');
    historyElement.className = 'mb-1 last:mb-0';
    historyElement.innerHTML = `
      <button class="flex w-full items-start gap-2 rounded-orb border border-orb-border bg-orb-bg px-2 py-1.5 text-left transition hover:border-orb-border-hi hover:bg-orb-surface-2" data-history-open-id="${historyEntry.id}" title="${escapeHtml(historyEntry.url)}">
        <img src="${escapeHtml(faviconUrl)}" alt="" referrerpolicy="no-referrer" class="mt-[2px] h-4 w-4 shrink-0 rounded-sm bg-white/80" />
        <span class="min-w-0 flex-1">
          <span class="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-orb-text">${escapeHtml(historyEntry.title || historyEntry.url)}</span>
          <span class="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-orb-text-dim">${escapeHtml(historyEntry.url)}</span>
          <span class="mt-0.5 block font-mono text-[10px] text-orb-text-dim">${escapeHtml(formatHistoryTimestamp(historyEntry.lastVisitedAt))} · ${historyEntry.visitCount}×</span>
        </span>
      </button>
    `;

    historyList.appendChild(historyElement);
  });
}

function renderFullPageView(): void {
  const activeView = state.fullPageView;
  const isOpen = activeView !== null;

  fullPageView.classList.toggle('hidden', !isOpen);
  fullPageBookmarks.classList.toggle('hidden', activeView !== 'bookmarks');
  fullPageHistory.classList.toggle('hidden', activeView !== 'history');
  fullPageDownloads.classList.toggle('hidden', activeView !== 'downloads');

  if (!isOpen) {
    return;
  }

  if (activeView === 'bookmarks') {
    fullPageTitle.textContent = 'Bookmarks';
    fullPageBookmarksList.innerHTML = '';
    const hasBookmarks = state.bookmarks.length > 0;
    fullPageBookmarksEmpty.style.display = hasBookmarks ? 'none' : 'block';

    state.bookmarks.forEach(bookmark => {
      const card = document.createElement('article');
      card.className =
        'flex items-start gap-2 rounded-orb border border-orb-border bg-orb-surface px-3 py-2 transition hover:border-orb-border-hi';
      card.innerHTML = `
        <button class="min-w-0 flex-1 bg-transparent text-left" data-full-bookmark-open-id="${bookmark.id}" title="${escapeHtml(bookmark.url)}">
          <span class="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-orb-text">${escapeHtml(bookmark.title || bookmark.url)}</span>
          <span class="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-orb-text-dim">${escapeHtml(bookmark.url)}</span>
        </button>
        <button class="h-7 shrink-0 rounded-orb border border-orb-border bg-orb-bg px-2 font-mono text-[10px] text-orb-text-dim transition hover:border-orb-border-hi hover:bg-orb-surface-2 hover:text-orb-text" data-full-bookmark-remove-id="${bookmark.id}">remove</button>
      `;

      fullPageBookmarksList.appendChild(card);
    });

    return;
  }

  if (activeView === 'downloads') {
    fullPageTitle.textContent = 'Downloads';
    fullPageDownloadsList.innerHTML = '';
    downloadDirectoryValue.textContent = state.downloadDirectory || 'Not set';

    const hasDownloads = state.downloads.length > 0;
    fullPageDownloadsEmpty.style.display = hasDownloads ? 'none' : 'block';

    state.downloads.forEach(download => {
      const card = document.createElement('article');
      card.className = 'rounded-orb border border-orb-border bg-orb-surface p-3 transition hover:border-orb-border-hi';

      const progressWidth = Math.max(0, Math.min(100, download.percent));
      const isActive = download.state === 'progressing' || download.state === 'paused';
      const canPause = download.state === 'progressing';
      const canResume = download.state === 'paused' && download.canResume;
      const canCancel = isActive;
      const canRemove = !isActive;
      const isCompleted = download.state === 'completed';
      const totalBytesText = download.totalBytes > 0 ? formatBytes(download.totalBytes) : 'unknown size';
      const progressMarkup = isActive
        ? `<div class="mb-3 h-[3px] overflow-hidden rounded-full bg-orb-surface-2"><div class="orb-progress-fill" style="width:${progressWidth}%"></div></div>`
        : '';
      const actionBtn = (label: string, attr: string, id: string, disabled: boolean): string =>
        `<button class="rounded-orb border border-orb-border bg-orb-bg px-2 py-1 font-mono text-[10px] text-orb-text-dim transition hover:border-orb-border-hi hover:bg-orb-surface-2 hover:text-orb-text disabled:cursor-default disabled:opacity-30" ${attr}="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>${label}</button>`;

      card.innerHTML = `
        <div class="mb-2.5 flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <h3 class="truncate font-mono text-[12px] font-semibold text-orb-text" title="${escapeHtml(download.fileName)}">${escapeHtml(download.fileName)}</h3>
            <p class="truncate font-mono text-[10px] text-orb-text-dim" title="${escapeHtml(download.savePath)}">${escapeHtml(download.savePath)}</p>
          </div>
          <span class="${getDownloadBadgeClass(download.state)}">${escapeHtml(getDownloadStateLabel(download.state))}</span>
        </div>
        ${progressMarkup}
        <div class="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-orb-text-dim">
          <span class="text-orb-accent">${download.percent}%</span>
          <span>${escapeHtml(formatBytes(download.receivedBytes))} / ${escapeHtml(totalBytesText)}</span>
          <span>${escapeHtml(formatBytes(download.speedBytesPerSecond))}/s</span>
        </div>
        <div class="flex flex-wrap gap-1">
          ${actionBtn('pause',        'data-download-pause-id',  download.id, !canPause)}
          ${actionBtn('resume',       'data-download-resume-id', download.id, !canResume)}
          ${actionBtn('cancel',       'data-download-cancel-id', download.id, !canCancel)}
          ${actionBtn('open',         'data-download-open-id',   download.id, !isCompleted)}
          ${actionBtn('show in explorer', 'data-download-show-id', download.id, !isCompleted)}
          ${actionBtn('remove',       'data-download-remove-id', download.id, !canRemove)}
        </div>
      `;

      fullPageDownloadsList.appendChild(card);
    });

    return;
  }

  fullPageTitle.textContent = 'History';
  fullPageHistoryList.innerHTML = '';
  const hasHistory = state.history.length > 0;
  fullPageHistoryEmpty.style.display = hasHistory ? 'none' : 'block';
  btnFullPageHistoryClear.disabled = !hasHistory;

  state.history.forEach(historyEntry => {
    const row = document.createElement('li');
    row.className = 'rounded-orb border border-orb-border bg-orb-surface px-3 py-2 transition hover:border-orb-border-hi hover:bg-orb-surface-2';
    row.innerHTML = `
      <button class="w-full bg-transparent text-left" data-full-history-open-id="${historyEntry.id}" title="${escapeHtml(historyEntry.url)}">
        <span class="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-orb-text">${escapeHtml(historyEntry.title || historyEntry.url)}</span>
        <span class="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-orb-text-dim">${escapeHtml(historyEntry.url)}</span>
        <span class="mt-0.5 block font-mono text-[10px] text-orb-text-dim">${escapeHtml(formatHistoryTimestamp(historyEntry.lastVisitedAt))} · ${historyEntry.visitCount}×</span>
      </button>
    `;

    fullPageHistoryList.appendChild(row);
  });
}

function render(): void {
  renderTabs();
  renderNavigation();
  renderBookmarkControls();
  renderDownloadsIndicator();
  renderBookmarkBar();
  renderBookmarkEditor();
  renderBookmarksSidebar();
  renderHistorySidebar();
  renderFullPageView();
}

function applyState(nextState: TabsStateSnapshot): void {
  // Remove routes for tabs that were closed
  const liveIds = new Set(nextState.tabs.map(t => t.id));
  for (const id of tabInternalRoutes.keys()) {
    if (!liveIds.has(id)) tabInternalRoutes.delete(id);
  }

  state.tabs = nextState.tabs;
  state.activeTabId = nextState.activeTabId;

  // Consume a pending internal route — bound to the newly active tab after createTab()
  if (pendingInternalRoute !== null && nextState.activeTabId !== null) {
    tabInternalRoutes.set(nextState.activeTabId, pendingInternalRoute);
    pendingInternalRoute = null;
  }

  // Restore the internal page that belongs to the newly active tab
  state.fullPageView =
    nextState.activeTabId !== null
      ? (tabInternalRoutes.get(nextState.activeTabId) ?? null)
      : null;

  render();
  syncBrowserBounds();
}

function applyBookmarks(nextBookmarks: BookmarkSnapshot[]): void {
  state.bookmarks = nextBookmarks;
  render();
}

function applyHistory(nextHistory: HistorySnapshot[]): void {
  state.history = nextHistory;
  render();
}

function applyDownloads(nextDownloads: DownloadSnapshot[]): void {
  const hasNewDownload = nextDownloads.some(download => !knownDownloadIds.has(download.id));
  if (hasNewDownload) {
    hasUnseenDownloads = true;
  }

  knownDownloadIds = new Set(nextDownloads.map(download => download.id));
  state.downloads = nextDownloads;
  render();
}

function setBookmarksSidebarOpen(isOpen: boolean): void {
  if (state.fullPageView) {
    if (state.activeTabId !== null) tabInternalRoutes.delete(state.activeTabId);
    state.fullPageView = null;
  }

  if (isOpen) {
    state.isHistorySidebarOpen = false;
  }

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

function setHistorySidebarOpen(isOpen: boolean): void {
  if (state.fullPageView) {
    if (state.activeTabId !== null) tabInternalRoutes.delete(state.activeTabId);
    state.fullPageView = null;
  }

  if (isOpen) {
    state.isBookmarksSidebarOpen = false;
  }

  if (state.isHistorySidebarOpen === isOpen) {
    return;
  }

  state.isHistorySidebarOpen = isOpen;
  render();
  syncBrowserBounds();
}

function toggleHistorySidebar(): void {
  setHistorySidebarOpen(!state.isHistorySidebarOpen);
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

function setFullPageView(view: 'history' | 'bookmarks' | 'downloads' | null): void {
  if (state.fullPageView === view) {
    return;
  }

  state.fullPageView = view;

  // Keep the per-tab map in sync so switching back restores the right page
  if (state.activeTabId !== null) {
    if (view !== null) {
      tabInternalRoutes.set(state.activeTabId, view);
    } else {
      tabInternalRoutes.delete(state.activeTabId);
    }
  }

  if (view === 'downloads') {
    hasUnseenDownloads = false;
  }

  if (view) {
    state.isBookmarksSidebarOpen = false;
    state.isHistorySidebarOpen = false;
    closeBookmarkEditor();
  }

  render();
  syncBrowserBounds();
}

// Opens an internal page in a dedicated new tab — Chrome-style.
// If a tab with this route already exists, focus it instead of opening a duplicate.
function openInternalPageInNewTab(view: 'history' | 'bookmarks' | 'downloads'): void {
  // Check for an existing tab with this internal route — focus it (Chrome-like)
  for (const [tabId, route] of tabInternalRoutes.entries()) {
    if (route === view) {
      activateTab(tabId);
      return;
    }
  }

  // No existing tab — create one and bind the route when it becomes active
  pendingInternalRoute = view;
  void window.orb.createTab();
}

function closeInternalPageTab(): void {
  if (state.activeTabId !== null) {
    tabInternalRoutes.delete(state.activeTabId);
    requestTabClose(window.orb, state.activeTabId);
  }
}

function navigate(input: string): void {
  const internalRoute = resolveInternalRoute(input);
  if (internalRoute) {
    // Navigating to an orb:// URL opens it in a new tab (Chrome-style)
    openInternalPageInNewTab(internalRoute);
    newTabSearch.value = '';
    return;
  }

  if (state.fullPageView) {
    if (state.activeTabId !== null) tabInternalRoutes.delete(state.activeTabId);
    state.fullPageView = null;
  }

  const value = requestNavigateActiveTab(window.orb, input);
  if (!value) {
    return;
  }

  closeBookmarkEditor();
  newTabSearch.value = '';
}

function activateTab(tabId: number): void {
  void window.orb.activateTab(tabId);
}

function closeTab(tabId: number): void {
  requestTabClose(window.orb, tabId);
}

function openMenu(): void {
  const rect = btnMenu.getBoundingClientRect();
  void window.orb.showMenu({
    screenX: window.screenX + Math.round(rect.right),
    screenY: window.screenY + Math.round(rect.bottom),
    isBookmarkBarVisible: state.isBookmarkBarVisible,
    theme: getCurrentTheme(),
  });
}

function openDownloadsPopoverWindow(): void {
  const rect = btnDownloadsIndicator.getBoundingClientRect();
  hasUnseenDownloads = false;
  render();

  void window.orb.showDownloadsPopover({
    screenX: window.screenX + Math.round(rect.right),
    screenY: window.screenY + Math.round(rect.bottom),
    theme: getCurrentTheme(),
  });
}

function handleMenuAction(action: MenuAction): void {
  switch (action) {
    case MENU_ACTIONS.NEW_TAB:
      requestNewTab();
      break;
    case MENU_ACTIONS.TOGGLE_BOOKMARKS:
      toggleBookmarksSidebar();
      break;
    case MENU_ACTIONS.TOGGLE_HISTORY:
      toggleHistorySidebar();
      break;
    case MENU_ACTIONS.OPEN_DOWNLOADS:
      openInternalPageInNewTab('downloads');
      break;
    case MENU_ACTIONS.TOGGLE_BOOKMARK_BAR:
      toggleBookmarkBar();
      break;
    case MENU_ACTIONS.TOGGLE_THEME: {
      const nextTheme = getNextTheme(getCurrentTheme());
      setStoredTheme(nextTheme);
      applyTheme(nextTheme);
      break;
    }
    case MENU_ACTIONS.OPEN_FLOAT_SEARCH:
      void window.orb.toggleFloat();
      break;
  }
}

btnNewTab.addEventListener('click', () => {
  requestNewTab();
});

btnBack.addEventListener('click', () => {
  void window.orb.goBack();
});

btnForward.addEventListener('click', () => {
  void window.orb.goForward();
});

btnReload.addEventListener('click', () => {
  const activeTab = getActiveTab();
  if (activeTab?.isLoading) {
    void window.orb.stop();
  } else {
    void window.orb.reload();
  }
});

btnBookmark.addEventListener('click', () => {
  triggerBookmarkAction();
});

btnHistoryClear.addEventListener('click', () => {
  void window.orb.clearHistory().then(applyHistory);
});

btnBookmarksClose.addEventListener('click', () => {
  setBookmarksSidebarOpen(false);
});

btnHistoryClose.addEventListener('click', () => {
  setHistorySidebarOpen(false);
});

btnBookmarksDetailed.addEventListener('click', () => {
  openInternalPageInNewTab('bookmarks');
});

btnHistoryDetailed.addEventListener('click', () => {
  openInternalPageInNewTab('history');
});

btnFullPageClose.addEventListener('click', () => {
  // Close the dedicated internal-page tab entirely (Chrome-style)
  if (state.fullPageView !== null) {
    closeInternalPageTab();
  } else {
    setFullPageView(null);
  }
});

btnFullPageHistoryClear.addEventListener('click', () => {
  void window.orb.clearHistory().then(applyHistory);
});

btnDownloadDirectorySelect.addEventListener('click', () => {
  void window.orb.selectDownloadDirectory().then(directory => {
    state.downloadDirectory = directory;
    render();
  });
});

btnDownloadsIndicator.addEventListener('click', event => {
  event.stopPropagation();
  openDownloadsPopoverWindow();
});

btnFloat.addEventListener('click', () => {
  void window.orb.toggleFloat();
});

btnMenu.addEventListener('click', () => {
  openMenu();
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

historyList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const openTarget = target.closest<HTMLElement>('[data-history-open-id]');
  if (!openTarget) {
    return;
  }

  const historyId = Number(openTarget.getAttribute('data-history-open-id'));
  if (!Number.isInteger(historyId) || historyId <= 0) {
    return;
  }

  const historyEntry = state.history.find(entry => entry.id === historyId);
  if (!historyEntry) {
    return;
  }

  navigate(historyEntry.url);
});

fullPageBookmarksList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const removeTarget = target.closest<HTMLElement>('[data-full-bookmark-remove-id]');
  if (removeTarget) {
    const bookmarkId = Number(removeTarget.getAttribute('data-full-bookmark-remove-id'));
    if (Number.isInteger(bookmarkId) && bookmarkId > 0) {
      void window.orb.removeBookmark(bookmarkId).then(applyBookmarks);
    }
    return;
  }

  const openTarget = target.closest<HTMLElement>('[data-full-bookmark-open-id]');
  if (!openTarget) {
    return;
  }

  const bookmarkId = Number(openTarget.getAttribute('data-full-bookmark-open-id'));
  if (!Number.isInteger(bookmarkId) || bookmarkId <= 0) {
    return;
  }

  const bookmark = state.bookmarks.find(entry => entry.id === bookmarkId);
  if (!bookmark) {
    return;
  }

  setFullPageView(null);
  navigate(bookmark.url);
});

fullPageHistoryList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const openTarget = target.closest<HTMLElement>('[data-full-history-open-id]');
  if (!openTarget) {
    return;
  }

  const historyId = Number(openTarget.getAttribute('data-full-history-open-id'));
  if (!Number.isInteger(historyId) || historyId <= 0) {
    return;
  }

  const historyEntry = state.history.find(entry => entry.id === historyId);
  if (!historyEntry) {
    return;
  }

  setFullPageView(null);
  navigate(historyEntry.url);
});

fullPageDownloadsList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const pauseTarget = target.closest<HTMLElement>('[data-download-pause-id]');
  if (pauseTarget) {
    const downloadId = pauseTarget.getAttribute('data-download-pause-id');
    if (downloadId) {
      void window.orb.pauseDownload(downloadId);
    }
    return;
  }

  const resumeTarget = target.closest<HTMLElement>('[data-download-resume-id]');
  if (resumeTarget) {
    const downloadId = resumeTarget.getAttribute('data-download-resume-id');
    if (downloadId) {
      void window.orb.resumeDownload(downloadId);
    }
    return;
  }

  const cancelTarget = target.closest<HTMLElement>('[data-download-cancel-id]');
  if (cancelTarget) {
    const downloadId = cancelTarget.getAttribute('data-download-cancel-id');
    if (downloadId) {
      void window.orb.cancelDownload(downloadId);
    }
    return;
  }

  const removeTarget = target.closest<HTMLElement>('[data-download-remove-id]');
  if (removeTarget) {
    const downloadId = removeTarget.getAttribute('data-download-remove-id');
    if (downloadId) {
      void window.orb.removeDownload(downloadId);
    }
    return;
  }

  const openTarget = target.closest<HTMLElement>('[data-download-open-id]');
  if (openTarget) {
    const downloadId = openTarget.getAttribute('data-download-open-id');
    if (downloadId) {
      void window.orb.openDownloadFile(downloadId);
    }
    return;
  }

  const showTarget = target.closest<HTMLElement>('[data-download-show-id]');
  if (showTarget) {
    const downloadId = showTarget.getAttribute('data-download-show-id');
    if (downloadId) {
      void window.orb.showDownloadInFolder(downloadId);
    }
  }
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

unsubscribeHistory = window.orb.onHistoryChanged(nextHistory => {
  applyHistory(nextHistory);
});

unsubscribeDownloads = window.orb.onDownloadsChanged(nextDownloads => {
  applyDownloads(nextDownloads);
});

unsubscribeMenuAction = window.orb.onMenuAction(action => {
  handleMenuAction(action);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.isBookmarkEditorOpen) {
    event.preventDefault();
    closeBookmarkEditor();
    return;
  }

  if (event.key === 'Escape' && state.fullPageView) {
    event.preventDefault();
    // Close the dedicated internal-page tab entirely (Chrome-style)
    closeInternalPageTab();
    return;
  }

  const mod = event.metaKey || event.ctrlKey;

  if (mod && event.key.toLowerCase() === 't') {
    event.preventDefault();
    requestNewTab();
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

  if (mod && event.key.toLowerCase() === 'h') {
    event.preventDefault();
    toggleHistorySidebar();
    return;
  }

  if (mod && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    openInternalPageInNewTab('downloads');
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
new ResizeObserver(updateTabCompactMode).observe(tabsContainer);

window.addEventListener('beforeunload', () => {
  themeMediaQuery.removeEventListener('change', onThemePreferenceChanged);

  unsubscribeOpenUrl?.();
  unsubscribeOpenUrl = null;

  unsubscribeTabsState?.();
  unsubscribeTabsState = null;

  unsubscribeBookmarks?.();
  unsubscribeBookmarks = null;

  unsubscribeHistory?.();
  unsubscribeHistory = null;

  unsubscribeDownloads?.();
  unsubscribeDownloads = null;

  unsubscribeMenuAction?.();
  unsubscribeMenuAction = null;
});

window.orb.getBookmarks().then(initialBookmarks => {
  applyBookmarks(initialBookmarks);
});

window.orb.getHistory().then(initialHistory => {
  applyHistory(initialHistory);
});

window.orb.getDownloads().then(initialDownloads => {
  applyDownloads(initialDownloads);
});

window.orb.getDownloadDirectory().then(initialDirectory => {
  state.downloadDirectory = initialDirectory;
  render();
});

window.orb.getTabsState().then(initialState => {
  applyState(initialState);
  if (initialState.tabs.length === 0) {
    requestNewTab();
  }
});
