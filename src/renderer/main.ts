import './styles/tailwind.css';
import type { BrowserBounds, TabSnapshot, TabsStateSnapshot } from '../shared/ipc-contract';
import {
  requestNavigateActiveTab,
  requestTabClose,
  requestTabCloseIfActive,
  requestTabCreate,
} from './interaction';

interface RendererState {
  tabs: TabSnapshot[];
  activeTabId: number | null;
}

const state: RendererState = {
  tabs: [],
  activeTabId: null,
};

const tabsContainer = document.getElementById('tabs') as HTMLDivElement;
const browserArea = document.getElementById('browser-area') as HTMLDivElement;
const newTabPage = document.getElementById('new-tab-page') as HTMLDivElement;
const addressBar = document.getElementById('address-bar') as HTMLInputElement;
const newTabSearch = document.getElementById('new-tab-search') as HTMLInputElement;
const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
const btnForward = document.getElementById('btn-forward') as HTMLButtonElement;
const btnReload = document.getElementById('btn-reload') as HTMLButtonElement;
const btnFloat = document.getElementById('btn-float') as HTMLButtonElement;
const btnNewTab = document.getElementById('btn-new-tab') as HTMLButtonElement;

let unsubscribeOpenUrl: (() => void) | null = null;
let unsubscribeTabsState: (() => void) | null = null;

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

function render(): void {
  renderTabs();
  renderNavigation();
}

function applyState(nextState: TabsStateSnapshot): void {
  state.tabs = nextState.tabs;
  state.activeTabId = nextState.activeTabId;
  render();
  syncBrowserBounds();
}

function navigate(input: string): void {
  const value = requestNavigateActiveTab(window.orb, input);
  if (!value) {
    return;
  }

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

btnFloat.addEventListener('click', () => {
  void window.orb.toggleFloat();
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

unsubscribeOpenUrl = window.orb.onOpenUrl(url => {
  // Float window already triggers main-process navigation; we mirror address text here.
  addressBar.value = url;
});

unsubscribeTabsState = window.orb.onTabsStateChanged(nextState => {
  applyState(nextState);
});

document.addEventListener('keydown', event => {
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

  if (mod && event.shiftKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    void window.orb.toggleFloat();
  }
});

window.addEventListener('resize', syncBrowserBounds);
new ResizeObserver(syncBrowserBounds).observe(browserArea);

window.addEventListener('beforeunload', () => {
  unsubscribeOpenUrl?.();
  unsubscribeOpenUrl = null;

  unsubscribeTabsState?.();
  unsubscribeTabsState = null;
});

window.orb.getTabsState().then(initialState => {
  applyState(initialState);
  if (initialState.tabs.length === 0) {
    requestTabCreate(window.orb);
  }
});
