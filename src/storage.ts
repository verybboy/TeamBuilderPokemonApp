export const API_CACHE_PREFIX = 'ptl-api:';
// Raw API responses are expendable; leave most localStorage space for saved work.
export const API_CACHE_BUDGET = 1024 * 1024;

export function isStorageQuotaError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

function cacheEntries(storage: Storage) {
  const entries: { key: string; bytes: number; time: number }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(API_CACHE_PREFIX)) continue;
    const raw = storage.getItem(key) || '';
    let time = 0;
    try {
      const value = JSON.parse(raw);
      if (typeof value.time === 'number' && Number.isFinite(value.time)) time = value.time;
    } catch {}
    entries.push({ key, bytes: (key.length + raw.length) * 2, time });
  }
  return entries.sort((a, b) => a.time - b.time);
}

/** setItem is atomic: an unsuccessful retry preserves the previous saved value. */
export function writeSavedData(key: string, value: string) {
  const storage = localStorage;
  try {
    storage.setItem(key, value);
    return;
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    // Only remove reconstructible API responses, never teams, builds or other app data.
    for (const entry of cacheEntries(storage)) {
      storage.removeItem(entry.key);
      try {
        storage.setItem(key, value);
        return;
      } catch (retryError) {
        if (!isStorageQuotaError(retryError)) throw retryError;
      }
    }
    throw error;
  }
}

export function cacheApiResponse(path: string, data: unknown) {
  try {
    const storage = localStorage,
      key = API_CACHE_PREFIX + path;
    const value = JSON.stringify({ time: Date.now(), data });
    const bytes = (key.length + value.length) * 2;
    if (bytes > API_CACHE_BUDGET) {
      storage.removeItem(key);
      return; // Large responses remain available in the API's in-memory cache.
    }
    const entries = cacheEntries(storage).filter((entry) => entry.key !== key);
    let used = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of entries) {
      if (used + bytes <= API_CACHE_BUDGET) break;
      storage.removeItem(entry.key);
      used -= entry.bytes;
    }
    storage.setItem(key, value);
  } catch {
    // Disk caching is optional; it must not prevent API reads or saved-work writes.
  }
}

export function storageFailureMessage(error: unknown, fallback: string) {
  if (isStorageQuotaError(error))
    return `${fallback} El almacenamiento local está lleno, incluso después de liberar la caché de PokéAPI. No hay un límite de equipos por cantidad. Exporta una copia de tus configuraciones para conservarlas.`;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'SecurityError')
    return `${fallback} El navegador está bloqueando el almacenamiento local de esta página.`;
  return fallback;
}
