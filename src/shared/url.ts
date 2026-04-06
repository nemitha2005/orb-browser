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

export function isHttpNavigationUrl(url: string): boolean {
  const parsedUrl = parseUrl(url);
  return parsedUrl ? HTTP_PROTOCOLS.has(parsedUrl.protocol) : false;
}

export function normalizeHttpUrl(input: string): string | null {
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

export function toNavigableUrl(input: string): string {
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
