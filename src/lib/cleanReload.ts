/**
 * The phone's Ctrl+Shift+R.
 *
 * Unregisters the service worker and deletes the app's caches, then loads the
 * page from the network. Notes are untouched: they live in Firestore's
 * IndexedDB cache and its write queue, which this never clears. Only the
 * app's own code is thrown away and fetched again.
 *
 * `location.reload()` alone can be served by the same service worker; with
 * the registration gone, `replace` fetches the current shell.
 */
export async function cleanReload(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map((registration) => registration.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (error) {
    console.error('[reload] could not clear the app cache', error);
  }
  window.location.replace(window.location.href);
}
