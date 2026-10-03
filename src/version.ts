// Application Version and Strict Anti-Cache Engine
// Incremented to force browsers, PWAs, and caches to flush completely
export const APP_VERSION = '4.4.0';
export const APP_BUILD_DATE = '2026.10.03-delivery-address-custom';

// Universal cache invalidation check for browsers and service workers
export function ensureLatestVersionLoaded() {
  try {
    const STORAGE_KEY = 'nasjah_internal_build_v';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    // 1. Purge outdated temporary caches only (preserve active store business data)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('nasjah_offline_store_v') || 
        k.startsWith('nasjah_cached_')
      )) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    localStorage.setItem(STORAGE_KEY, APP_VERSION);

    // 2. Obliterate all browser CacheStorage instances (service worker caches)
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).catch(() => {});
      }).catch(() => {});
    }

    // 3. Unregister all existing service workers immediately
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach(r => r.unregister().catch(() => {}));
      }).catch(() => {});
    }

    // 4. If upgrading from older version (e.g. 2.8.0), reload once to run clean code
    if (lastVersion && lastVersion !== APP_VERSION) {
      console.log(`[Nasjah Auto-Updater] Upgraded from ${lastVersion} to ${APP_VERSION}. Reloading clean...`);
      window.location.reload();
    }
  } catch (err) {
    // Silent fail if localStorage is restricted
  }
}
