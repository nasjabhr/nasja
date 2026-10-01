// Application Version and Cache Busting Engine
// Incremented to force browsers, PWAs, and Service Workers to flush outdated assets
export const APP_VERSION = '2.5.0';
export const APP_BUILD_DATE = '2026.10.01';

// Auto cache invalidation check for browsers and service workers
export function ensureLatestVersionLoaded() {
  try {
    const STORAGE_KEY = 'nasjah_internal_build_v';
    const lastVersion = localStorage.getItem(STORAGE_KEY);
    
    if (lastVersion !== APP_VERSION) {
      // Purge all browser CacheStorage instances
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        });
      }
      // Force update service workers to reload fresh application bundle
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((reg) => {
            reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      }
    }
    
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch (err) {
    // Silent fail if localStorage is restricted
  }
}

