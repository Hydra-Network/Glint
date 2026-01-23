importScripts("/scram/scramjet.all.js");

const CACHE_VERSION = 'glint-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/reviews.css',
  '/images/logo.png',
  '/images/favicon.png',
  '/js/main.js',
  '/js/search.js',
  '/js/proxy-config.js',
  '/js/options.js',
  '/js/register-sw.js',
  '/js/utils/url-utils.js',
  '/js/utils/favicon.js',
  '/js/utils/proxy-frames.js',
  '/js/tabs/tab-history.js',
  '/js/tabs/tab-storage.js',
  '/js/tabs/tab-dragging.js',
  '/js/tabs/tab-management.js',
  '/js/navigation/navigation.js',
  '/scram/scramjet.all.js',
  '/scram/scramjet.sync.js',
  '/scram/scramjet.wasm.wasm'
];

const AD_DOMAINS = new Set([
  'effectivegatecpm.com',
  'weirdopt.com',
  'wayfarerorthodox.com',
  'preferencenail.com',
  'kettledroopingcontinuation.com'
]);

if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: true
  });
}

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

let configPromise = scramjet.loadConfig().catch(e => {
  console.error('scramjet config load failed:', e);
  return false;
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('.wasm')))
        .catch(err => {
          console.warn('Some assets failed to cache:', err);
        });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('glint-') && 
                     name !== STATIC_CACHE && 
                     name !== RUNTIME_CACHE;
            })
            .map((name) => caches.delete(name))
        );
      })
    ])
  );
});

function isStaticAsset(url) {
  const pathname = url.pathname;
  return pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|woff2?|ttf|svg)(\?.*)?$/i) ||
         STATIC_ASSETS.some(asset => pathname === asset || pathname.endsWith(asset));
}

async function handleRequest(event) {
  const url = new URL(event.request.url);
  
  if (AD_DOMAINS.has(url.hostname) || 
      [...AD_DOMAINS].some(domain => url.hostname.includes(domain))) {
    return fetch(event.request);
  }
  
  if (event.request.url.includes('favicon.ico') || 
      event.request.url.includes('apple-touch-icon') ||
      event.request.destination === 'favicon') {
    try {
      if (scramjet.route?.(event)) {
        const response = await scramjet.fetch(event);
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          return response;
        }
      }
      
      const directResponse = await fetch(event.request);
      if (directResponse.ok && directResponse.headers.get('content-type')?.startsWith('image/')) {
        return directResponse;
      }
    } catch (e) {
    }
    
    return new Response(null, { status: 404 });
  }

  if (url.pathname.startsWith('/scramjet/')) {
    try {
      await Promise.race([
        configPromise,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
      if (scramjet?.fetch) {
        return await scramjet.fetch(event);
      }
      
      return new Response('Scramjet proxy not available', { 
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    } catch (e) {
      console.error('scramjet request error:', e);
      return new Response('Proxy error: ' + e.message, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }

  if (scramjet.route?.(event)) {
    try {
      return await scramjet.fetch(event);
    } catch (e) {
      console.error('scramjet fetch error:', e);
    }
  }

  if (isStaticAsset(url) && event.request.method === 'GET') {
    try {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(event.request);
      
      if (cached) {
        fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response);
          }
        }).catch(() => {});
        return cached;
      }
      
      const response = await fetch(event.request);
      if (response.ok) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (e) {
    }
  }

  return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});
