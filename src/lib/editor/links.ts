const EDITOR_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const DOMAIN = /^(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?:[/:?#]\S*)?$/u;

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith("#")) return true;
  if (/^[/\\]{2}/.test(value)) return false;
  if (value.startsWith("/")) return true;
  if (!SCHEME.test(value)) return !value.includes(":");
  return normalizeLinkInput(value) !== null;
}

export function normalizeLinkInput(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;

  let candidate = value;
  if (!SCHEME.test(value)) {
    if (EMAIL.test(value)) candidate = `mailto:${value}`;
    else if (DOMAIN.test(value)) candidate = `https://${value}`;
    else return null;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!EDITOR_PROTOCOLS.has(url.protocol)) return null;
  if (url.protocol === "mailto:") return EMAIL.test(url.pathname) ? candidate : null;
  if (!url.hostname) return null;
  return candidate;
}
