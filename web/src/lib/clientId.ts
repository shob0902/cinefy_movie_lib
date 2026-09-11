// Stable anonymous device id used to scope the wishlist.
const STORAGE_KEY = 'cinefy.clientId';
function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
let cached: string | undefined;
export function getClientId(): string {
  if (cached) return cached;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const created = createId();
    window.localStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return created;
  } catch {
    cached ??= createId();
    return cached;
  }
}
