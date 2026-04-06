(() => {
  // The renderer only draws UI; main process owns real tab/browser state.
  const state = {
    tabs: [],
    activeTabId: null,
  };

  const tabsContainer = document.getElementById('tabs');
  const browserArea = document.getElementById('browser-area');
  const newTabPage = document.getElementById('new-tab-page');
  const addressBar = document.getElementById('address-bar');
  const newTabSearch = document.getElementById('new-tab-search');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnReload = document.getElementById('btn-reload');
  const btnFloat = document.getElementById('btn-float');
  const btnNewTab = document.getElementById('btn-new-tab');

  function escapeHtml(input) {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getActiveTab() {
    return state.tabs.find(tab => tab.id === state.activeTabId);
  }

  function syncBrowserBounds() {
    // BrowserView lives in main process, so we send UI coordinates over IPC.
    const rect = browserArea.getBoundingClientRect();
    const bounds = {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };

    window.orb.setBrowserBounds(bounds);
  }

  function renderTabs() {
    tabsContainer.innerHTML = '';

    state.tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = `tab${tab.id === state.activeTabId ? ' active' : ''}`;
      el.dataset.id = String(tab.id);
      el.innerHTML = `
        <span class="tab-title">${escapeHtml(tab.title || 'New Tab')}</span>
        <button class="tab-close" data-close-id="${tab.id}">X</button>
      `;
      tabsContainer.appendChild(el);
    });
  }

  function renderNavigation() {
    const activeTab = getActiveTab();

    addressBar.value = activeTab?.url || '';
    btnBack.disabled = !(activeTab && activeTab.canGoBack);
    btnForward.disabled = !(activeTab && activeTab.canGoForward);

    // No URL means this tab is in "new tab" state.
    newTabPage.style.display = activeTab?.url ? 'none' : 'flex';
  }

  function render() {
    renderTabs();
    renderNavigation();
  }

  function applyState(nextState) {
    if (!nextState || !Array.isArray(nextState.tabs)) {
      return;
    }

    state.tabs = nextState.tabs;
    state.activeTabId = nextState.activeTabId;
    render();
    syncBrowserBounds();
  }

  function navigate(input) {
    const value = input.trim();
    if (!value) {
      return;
    }

    // Main process normalizes this value into URL/search safely.
    window.orb.navigateActiveTab(value);
    newTabSearch.value = '';
  }

  function activateTab(tabId) {
    window.orb.activateTab(tabId);
  }

  function closeTab(tabId) {
    window.orb.closeTab(tabId);
  }

  btnNewTab.addEventListener('click', () => {
    window.orb.createTab();
  });

  btnBack.addEventListener('click', () => {
    window.orb.goBack();
  });

  btnForward.addEventListener('click', () => {
    window.orb.goForward();
  });

  btnReload.addEventListener('click', () => {
    window.orb.reload();
  });

  btnFloat.addEventListener('click', () => {
    window.orb.toggleFloat();
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

  window.orb.onOpenUrl(url => {
    // Float window already asks main to navigate; we only mirror the text field.
    addressBar.value = url;
  });

  window.orb.onTabsStateChanged(nextState => {
    applyState(nextState);
  });

  document.addEventListener('keydown', event => {
    const mod = event.metaKey || event.ctrlKey;

    if (mod && event.key.toLowerCase() === 't') {
      event.preventDefault();
      window.orb.createTab();
      return;
    }

    if (mod && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (state.activeTabId) {
        closeTab(state.activeTabId);
      }
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
      window.orb.reload();
      return;
    }

    if (mod && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      window.orb.toggleFloat();
    }
  });

  // Keep BrowserView size in sync as UI layout changes.
  window.addEventListener('resize', syncBrowserBounds);
  new ResizeObserver(syncBrowserBounds).observe(browserArea);

  window.orb.getTabsState().then(initialState => {
    applyState(initialState);
    if (initialState.tabs.length === 0) {
      window.orb.createTab();
    }
  });
})();
