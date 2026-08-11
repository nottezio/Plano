/**
 * Ask the browser not to evict our storage.
 *
 * Firebase Auth keeps its session in IndexedDB, and Firestore's offline cache
 * lives there too. By default that storage is "best effort": the browser may
 * clear it under storage pressure, and Safari clears it after roughly seven
 * days of not visiting the site. When it goes, the user is signed out and the
 * offline cache is empty — which reads as the app randomly logging you out,
 * and hits one device and not another depending on how full it is.
 *
 * `navigator.storage.persist()` moves us to "persistent": the browser keeps the
 * data until the user clears it explicitly. Chrome grants it silently when the
 * site is installed or sufficiently engaged; Safari grants it to installed web
 * apps. There is no way to force it, so this reports the outcome rather than
 * assuming success — Settings shows it, because "install the app to stay signed
 * in" is only useful advice if you know it applies to you.
 */
export type StoragePersistence = 'persisted' | 'best-effort' | 'unsupported';

export async function requestPersistentStorage(): Promise<StoragePersistence> {
  if (!navigator.storage?.persist || !navigator.storage.persisted) return 'unsupported';

  try {
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
  } catch (error) {
    console.warn('[storage] persistence request failed', error);
    return 'unsupported';
  }
}

export async function currentPersistence(): Promise<StoragePersistence> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}
