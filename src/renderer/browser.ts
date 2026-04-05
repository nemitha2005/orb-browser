interface Window {
  orb: {
    toggleFloat: () => Promise<void>;
    floatNavigate: (url: string) => Promise<void>;
    onOpenUrl: (callback: (url: string) => void) => void;
    platform: string;
  };
}

interface Tab {
  id: number;
  title: string;
  url: string | null;
  webview: Electron.WebviewTag;
}

let tabs: Tab[] = [];
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

function toUrl(input: string): string {
  const val = input.trim();
  if (!val) return '';
  if (/^https?:\/\//i.test(val)) return val;
  if (/^[\w-]+\.[a-z]{2,}(\/|$)/i.test(val)) return `https://${val}`;
  return `https://www.google.com/search?q=${encodeURIComponent(val)}`;
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

  webview.addEventListener('did-navigate', (e: any) => {
    if (activeTabId === id) {
      addressBar.value = e.url;
      updateNavButtons();
    }
    tab.url = e.url;
  });

  webview.addEventListener('page-title-updated', (e: any) => {
    tab.title = e.title;
    renderTabs();
  });

  setActiveTab(id);
  renderTabs();
}

function closeTab(id: number): void {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;

  tabs[idx].webview.remove();
  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    createTab();
  } else {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    setActiveTab(next.id);
    renderTabs();
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