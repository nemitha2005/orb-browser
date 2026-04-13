export type OrbTheme = 'light' | 'dark';

export const ORB_THEME_STORAGE_KEY = 'orb-theme';

export function normalizeTheme(value: string | null | undefined): OrbTheme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveTheme(
  storedTheme: string | null | undefined,
  prefersDark: boolean,
): OrbTheme {
  const normalizedTheme = normalizeTheme(storedTheme);
  if (normalizedTheme) {
    return normalizedTheme;
  }

  return prefersDark ? 'dark' : 'light';
}

export function getNextTheme(theme: OrbTheme): OrbTheme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function getThemeToggleMeta(theme: OrbTheme): { icon: string; title: string } {
  if (theme === 'dark') {
    return {
      icon: '☀',
      title: 'Switch to light mode',
    };
  }

  return {
    icon: '☾',
    title: 'Switch to dark mode',
  };
}