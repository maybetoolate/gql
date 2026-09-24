/** Resolve a cover path to a loadable URL (dev proxy vs absolute API origin). */
export function coverSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = import.meta.env.VITE_GRAPHQL_URL as string | undefined;
  if (!base) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

/** Base URL for REST calls (upload). Empty string in dev (same-origin proxy). */
export function apiBase(): string {
  const base = import.meta.env.VITE_GRAPHQL_URL as string | undefined;
  if (!base) return "";
  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}
