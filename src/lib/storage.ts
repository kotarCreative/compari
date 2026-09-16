/**
 * SSR-safe sessionStorage helpers.
 *
 * TanStack Start renders routes on the server, where `window` is undefined.
 * Read/write through these helpers instead of touching `sessionStorage`
 * directly so render-time access cannot crash SSR or hydration. Storage
 * access can also throw (e.g. blocked third-party storage), so failures
 * degrade to null/no-op rather than breaking the page.
 */
export function readSession(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSession(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Storage is unavailable (SSR, private mode); the in-memory state
    // already holds the value, so persistence is best-effort.
  }
}

export function removeSession(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Best-effort cleanup; ignore when storage is unavailable.
  }
}
