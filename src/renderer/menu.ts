import './styles/tailwind.css';
import { MENU_ACTIONS } from '../shared/ipc-contract';
import type { MenuAction, MenuInitPayload } from '../shared/ipc-contract';
import { ICONS } from './icons';
import { normalizeTheme, ORB_THEME_STORAGE_KEY, resolveTheme } from './theme';

const menuContainer = document.getElementById('menu') as HTMLDivElement;
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

let menuState: MenuInitPayload = { isBookmarkBarVisible: true, theme: 'dark' };

function getStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(ORB_THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function syncTheme(): void {
  const resolvedTheme = resolveTheme(getStoredTheme(), themeMediaQuery.matches);
  document.documentElement.dataset.theme = resolvedTheme;
}

const onSystemThemeChanged = (): void => {
  if (!normalizeTheme(getStoredTheme())) {
    syncTheme();
  }
};

syncTheme();
themeMediaQuery.addEventListener('change', onSystemThemeChanged);

interface MenuItem {
  type: 'action';
  action: MenuAction;
  icon: string;
  label: string;
  shortcut?: string;
  checked?: boolean;
}

interface MenuSeparator {
  type: 'separator';
}

type MenuEntry = MenuItem | MenuSeparator;

function buildMenuEntries(): MenuEntry[] {
  const { isBookmarkBarVisible, theme } = menuState;
  const themeIcon = theme === 'dark' ? ICONS.sun : ICONS.moon;
  const themeLabel = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

  return [
    {
      type: 'action',
      action: MENU_ACTIONS.NEW_TAB,
      icon: ICONS.plus,
      label: 'New Tab',
      shortcut: 'Ctrl+T',
    },
    { type: 'separator' },
    {
      type: 'action',
      action: MENU_ACTIONS.TOGGLE_BOOKMARKS,
      icon: ICONS.bookmarks,
      label: 'Bookmarks',
    },
    {
      type: 'action',
      action: MENU_ACTIONS.TOGGLE_HISTORY,
      icon: ICONS.history,
      label: 'History',
      shortcut: 'Ctrl+H',
    },
    { type: 'separator' },
    {
      type: 'action',
      action: MENU_ACTIONS.TOGGLE_BOOKMARK_BAR,
      icon: ICONS.bookmarkBar,
      label: 'Bookmarks Bar',
      checked: isBookmarkBarVisible,
    },
    { type: 'separator' },
    {
      type: 'action',
      action: MENU_ACTIONS.TOGGLE_THEME,
      icon: themeIcon,
      label: themeLabel,
    },
    { type: 'separator' },
    {
      type: 'action',
      action: MENU_ACTIONS.OPEN_FLOAT_SEARCH,
      icon: ICONS.floatSearch,
      label: 'Floating Search',
      shortcut: 'Ctrl+Shift+O',
    },
  ];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMenu(): void {
  const entries = buildMenuEntries();
  menuContainer.innerHTML = '';

  entries.forEach(entry => {
    if (entry.type === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'my-1 border-t border-orb-border';
      menuContainer.appendChild(sep);
      return;
    }

    const btn = document.createElement('button');
    btn.className =
      'flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] text-orb-text' +
      ' transition-colors hover:bg-orb-surface-2 active:bg-orb-surface-2' +
      ' border-0 bg-transparent cursor-default';
    btn.dataset.action = entry.action;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'flex h-4 w-4 shrink-0 items-center justify-center text-orb-text-dim';
    iconSpan.innerHTML = entry.icon;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'flex-1 select-none';
    labelSpan.textContent = entry.label;

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);

    if (entry.checked !== undefined) {
      const checkSpan = document.createElement('span');
      checkSpan.className = 'ml-auto flex h-4 w-4 shrink-0 items-center justify-center text-orb-accent';
      if (entry.checked) {
        checkSpan.innerHTML = ICONS.check;
      }
      btn.appendChild(checkSpan);
    } else if (entry.shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.className = 'ml-auto shrink-0 select-none font-mono text-[11px] text-orb-text-dim';
      shortcutSpan.textContent = escapeHtml(entry.shortcut);
      btn.appendChild(shortcutSpan);
    }

    menuContainer.appendChild(btn);
  });
}

menuContainer.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const btn = target.closest<HTMLElement>('[data-action]');
  if (!btn) {
    return;
  }

  const action = btn.dataset.action as MenuAction | undefined;
  if (!action) {
    return;
  }

  void window.orb.menuAction(action);
});

window.orb.onMenuInit(state => {
  menuState = state;
  document.documentElement.dataset.theme = state.theme;
  renderMenu();
});

window.addEventListener('storage', event => {
  if (event.key === ORB_THEME_STORAGE_KEY) {
    syncTheme();
  }
});

window.addEventListener('focus', () => {
  syncTheme();
});

window.addEventListener('beforeunload', () => {
  themeMediaQuery.removeEventListener('change', onSystemThemeChanged);
});
