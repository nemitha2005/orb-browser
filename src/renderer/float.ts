import './styles/tailwind.css';
import { normalizeTheme, ORB_THEME_STORAGE_KEY, resolveTheme } from './theme';

const input = document.getElementById('input') as HTMLInputElement;
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

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

const onThemePreferenceChanged = (): void => {
  if (!normalizeTheme(getStoredTheme())) {
    syncTheme();
  }
};

syncTheme();
themeMediaQuery.addEventListener('change', onThemePreferenceChanged);

function submitInput(): void {
  const value = input.value.trim();
  if (!value) {
    return;
  }

  void window.orb.floatNavigate(value);
  input.value = '';
}

input.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    submitInput();
    return;
  }

  if (event.key === 'Escape') {
    void window.orb.toggleFloat();
    input.value = '';
  }
});

window.addEventListener('focus', () => {
  syncTheme();
  input.focus();
  input.select();
});

window.addEventListener('storage', event => {
  if (event.key === ORB_THEME_STORAGE_KEY) {
    syncTheme();
  }
});

window.addEventListener('beforeunload', () => {
  themeMediaQuery.removeEventListener('change', onThemePreferenceChanged);
});
