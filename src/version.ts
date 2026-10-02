// Application Version and Cache Busting Engine
// Incremented to force browsers, PWAs, and Service Workers to flush outdated assets
export const APP_VERSION = '2.8.0';
export const APP_BUILD_DATE = '2026.10.02';

// Auto cache invalidation check for browsers and service workers
export function ensureLatestVersionLoaded() {
  try {
    const STORAGE_KEY = 'nasjah_internal_build_v';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    // Purge whenever lastVersion does not match current version (including first run or upgrade)
    if (!lastVersion || lastVersion !== APP_VERSION) {
      console.log(`[Nasjah Auto-Updater] Upgrading to version ${APP_VERSION} (previous: ${lastVersion})...`);

      // 1. Purge all outdated local storage data caches
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (
          k.startsWith('nasjah_offline_store') || 
          k.startsWith('nasjah_store_data') || 
          k.startsWith('nasjah_cached_')
        )) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      // 2. Set new version marker immediately
      localStorage.setItem(STORAGE_KEY, APP_VERSION);

      // 3. Purge all browser CacheStorage instances (service worker caches)
      if ('caches' in window) {
        caches.keys().then((names) => {
          Promise.all(names.map((name) => caches.delete(name))).then(() => {
            // 4. Unregister existing service workers to fetch fresh bundle
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then((registrations) => {
                Promise.all(registrations.map(r => r.unregister())).then(() => {
                  window.location.reload();
                });
              });
            } else {
              window.location.reload();
            }
          });
        });
        return;
      }
    }
    
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch (err) {
    // Silent fail if localStorage is restricted
  }
}
