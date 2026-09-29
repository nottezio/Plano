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
/**
 * Whether the server can be reached right now. Any HTTP answer counts; only
 * a network failure does not. The query string keeps it out of the
 * service worker's precache, so it is a real request.
 */
async function serverReachable(): Promise<boolean> {
  try {
    await fetch(`${import.meta.env.BASE_URL}manifest.webmanifest?reach=${String(Date.now())}`, {
      cache: 'no-store',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns false, and changes nothing, when the server cannot be reached.
 * Offered on the slow-boot screen, which appears exactly when the network is
 * bad: throwing the offline copy of the app away there left the phone with
 * the browser's offline page and no app until the signal came back.
 */
export async function cleanReload(): Promise<boolean> {
  if (!(await serverReachable())) return false;
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map((registration) => registration.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (error) {
    console.error('[reload] could not clear the app cache', error);
  }
  window.location.replace(window.location.href);
  return true;
}
