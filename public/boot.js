/* Nasjah boot script (moved out of index.html so the Content-Security-Policy can forbid inline scripts) */
      // Gracefully handle Vite HMR in cloud sandbox preview environment
      (() => {
        // 1. Mock WebSocket specifically for vite-hmr / vite-ping so connection succeeds cleanly
        const OrigWS = window.WebSocket;
        if (OrigWS) {
          window.WebSocket = function (url, protocols) {
            const isViteHMR =
              (typeof protocols === 'string' && (protocols === 'vite-hmr' || protocols === 'vite-ping')) ||
              (Array.isArray(protocols) && (protocols.includes('vite-hmr') || protocols.includes('vite-ping'))) ||
              (typeof url === 'string' && (url.includes('vite-hmr') || url.includes('token=') || url.includes('vite-ping')));

            if (!isViteHMR) {
              return new OrigWS(url, protocols);
            }

            const emitter = new EventTarget();
            const socket = {
              readyState: 1, // OPEN
              url,
              protocol: typeof protocols === 'string' ? protocols : 'vite-hmr',
              extensions: '',
              binaryType: 'blob',
              bufferedAmount: 0,
              send() {},
              close() {
                socket.readyState = 3;
                const evt = new Event('close');
                emitter.dispatchEvent(evt);
                if (typeof socket.onclose === 'function') socket.onclose(evt);
              },
              addEventListener(type, fn, opt) { emitter.addEventListener(type, fn, opt); },
              removeEventListener(type, fn, opt) { emitter.removeEventListener(type, fn, opt); },
              dispatchEvent(e) { return emitter.dispatchEvent(e); },
              onopen: null,
              onmessage: null,
              onerror: null,
              onclose: null,
            };

            setTimeout(() => {
              const openEvt = new Event('open');
              emitter.dispatchEvent(openEvt);
              if (typeof socket.onopen === 'function') socket.onopen(openEvt);
            }, 5);

            return socket;
          };

          window.WebSocket.prototype = OrigWS.prototype;
          window.WebSocket.CONNECTING = 0;
          window.WebSocket.OPEN = 1;
          window.WebSocket.CLOSING = 2;
          window.WebSocket.CLOSED = 3;
        }

        // 2. Filter benign vite logs from browser console
        const isViteLog = (arg) => {
          if (!arg) return false;
          const text = typeof arg === 'string' ? arg : (arg.message || arg.stack || String(arg));
          return text.includes('[vite]') || text.includes('websocket') || text.includes('WebSocket');
        };

        const wrap = (fn) => (...args) => {
          if (args.some(isViteLog)) return;
          fn.apply(console, args);
        };

        console.error = wrap(console.error);
        console.warn = wrap(console.warn);
        console.info = wrap(console.info);
        console.log = wrap(console.log);
        console.debug = wrap(console.debug);

        window.addEventListener('unhandledrejection', (e) => {
          if (isViteLog(e.reason)) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);

        window.addEventListener('error', (e) => {
          if (isViteLog(e.message) || isViteLog(e.error)) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);
      })();

      // Early capture of PWA beforeinstallprompt to ensure direct native install
      window.__pwaInstallPrompt = null;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.__pwaInstallPrompt = e;
        window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
      });
      window.addEventListener('appinstalled', () => {
        window.__pwaInstallPrompt = null;
        try { localStorage.setItem('pwa_app_installed', 'true'); } catch (_) {}
        window.dispatchEvent(new CustomEvent('pwa-installed'));
      });

      // ========================================================
      // NASJAH STRICT ZERO-CACHE & SERVICE-WORKER ANNIHILATOR
      // Runs before everything to guarantee completely fresh execution
      // ========================================================
      (() => {
        // 1. Instantly unregister all Service Workers across all devices
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((reg) => {
              reg.unregister().catch(() => {});
            });
          }).catch(() => {});
        }

        // 2. Obliterate all browser CacheStorage instances (SW caches)
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => {
              caches.delete(name).catch(() => {});
            });
          }).catch(() => {});
        }

        // 3. Purge obsolete service worker & build caches only (preserve active store business data)
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (
              k.startsWith('nasjah_offline_store_v') ||
              k.startsWith('nasjah_cached_')
            )) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => {
            try { localStorage.removeItem(k); } catch (_) {}
          });
        } catch (_) {}
      })();
    