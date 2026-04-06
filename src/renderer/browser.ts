interface Tab {
  id: number;
  title: string;
  url: string | null;
  webview: Electron.WebviewTag;
}

interface WebviewUrlEvent extends Event {
  url: string;
}

interface WebviewTitleEvent extends Event {
  title: string;
}

const tabs: Tab[] = [];
let activeTabId: number = 0;
let tabCounter: number = 0;

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

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const SCHEME_PREFIX_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const DOMAIN_LIKE_RE = /^[\w-]+(\.[\w-]+)+([/?#].*)?$/i;

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isSafeWebviewUrl(url: string): boolean {
  const parsedUrl = parseUrl(url);
  return parsedUrl ? HTTP_PROTOCOLS.has(parsedUrl.protocol) : false;
}

function normalizeHttpUrl(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const withScheme = SCHEME_PREFIX_RE.test(trimmedInput)
    ? trimmedInput
    : `https://${trimmedInput}`;

  const parsedUrl = parseUrl(withScheme);
  if (!parsedUrl || !HTTP_PROTOCOLS.has(parsedUrl.protocol)) {
    return null;
  }

  return parsedUrl.toString();
}

function toUrl(input: string): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmedInput) || DOMAIN_LIKE_RE.test(trimmedInput)) {
    const normalizedUrl = normalizeHttpUrl(trimmedInput);
    if (normalizedUrl) {
      return normalizedUrl;
    }
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmedInput)}`;
}

function getActiveTab(): Tab | undefined {
  return tabs.find(t => t.id === activeTabId);
}

function createTab(url: string | null = null): void {
  const id = ++tabCounter;

  const webview = document.createElement('webview') as Electron.WebviewTag;
  webview.id = `webview-${id}`;
  webview.setAttribute('allowpopups', 'false');
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.border = 'none';
  webview.style.display = 'none';

  if (url) webview.src = url;
  browserArea.appendChild(webview);

  const tab: Tab = {
    id,
    title: url ? 'Loading…' : 'New Tab',
    url,
    webview,
  };

  tabs.push(tab);

  webview.addEventListener('will-navigate', (event: Event) => {
    const navigationEvent = event as WebviewUrlEvent;
    if (!isSafeWebviewUrl(navigationEvent.url)) {
      event.preventDefault();
    }
  });

  webview.addEventListener('new-window', (event: Event) => {
    event.preventDefault();
  });

  webview.addEventListener('did-navigate', (event: Event) => {
    const navigationEvent = event as WebviewUrlEvent;
    if (!isSafeWebviewUrl(navigationEvent.url)) {
      return;
    }

    if (activeTabId === id) {
      addressBar.value = navigationEvent.url;
      updateNavButtons();
    }
    tab.url = navigationEvent.url;
  });

  webview.addEventListener('page-title-updated', (event: Event) => {
    const titleEvent = event as WebviewTitleEvent;
    tab.title = titleEvent.title;
    renderTabs();
  });

  setActiveTab(id);
  renderTabs();
}

function closeTab(id: number): void {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;

  const tabToClose = tabs[idx];
  if (!tabToClose) {
    return;
  }

  tabToClose.webview.remove();
  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    createTab();
  } else {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    if (next) {
      setActiveTab(next.id);
      renderTabs();
    }
  }
}

function setActiveTab(id: number): void {
  activeTabId = id;
  const tab = tabs.find(t => t.id === id);

  tabs.forEach(t => {
    t.webview.style.display = t.id === id ? 'flex' : 'none';
  });

  if (tab) {
    newTabPage.style.display = tab.url ? 'none' : 'flex';
    addressBar.value = tab.url ?? '';
    updateNavButtons();
  }

  renderTabs();
}

function renderTabs(): void {
  tabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = `tab${tab.id === activeTabId ? ' active' : ''}`;
    el.innerHTML = `
      <span class="tab-title">${tab.title}</span>
      <button class="tab-close" data-id="${tab.id}">✕</button>
    `;

    el.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tab-close')) {
        closeTab(tab.id);
      } else {
        setActiveTab(tab.id);
      }
    });

    tabsContainer.appendChild(el);
  });
}

function navigate(input: string): void {
  const url = toUrl(input);
  if (!url) return;

  const tab = getActiveTab();
  if (!tab) return;

  tab.url = url;
  tab.webview.src = url;
  tab.webview.style.display = 'flex';
  newTabPage.style.display = 'none';
  addressBar.value = url;
  renderTabs();
}

function updateNavButtons(): void {
  const tab = getActiveTab();
  if (!tab?.url) {
    btnBack.disabled = true;
    btnForward.disabled = true;
    return;
  }
  try {
    btnBack.disabled = !tab.webview.canGoBack();
    btnForward.disabled = !tab.webview.canGoForward();
  } catch {
    btnBack.disabled = true;
    btnForward.disabled = true;
  }
}

btnNewTab.addEventListener('click', () => createTab());

addressBar.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') navigate(addressBar.value);
});

newTabSearch.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') navigate(newTabSearch.value);
});


btnBack.addEventListener('click', () => getActiveTab()?.webview.goBack());
btnForward.addEventListener('click', () => getActiveTab()?.webview.goForward());
btnReload.addEventListener('click', () => getActiveTab()?.webview.reload());


btnFloat.addEventListener('click', () => window.orb.toggleFloat());

window.orb.onOpenUrl((url: string) => {
  navigate(url);
});

document.addEventListener('keydown', (e: KeyboardEvent) => {
  const mod = e.metaKey || e.ctrlKey;

  if (mod && e.key === 't') {
    e.preventDefault();
    createTab();
  }

  if (mod && e.key === 'w') {
    e.preventDefault();
    closeTab(activeTabId);
  }

  if (mod && e.key === 'l') {
    e.preventDefault();
    addressBar.focus();
    addressBar.select();
  }

  if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    window.orb.toggleFloat();
  }

  if (mod && e.key === 'r') {
    e.preventDefault();
    getActiveTab()?.webview.reload();
  }
});


createTab();