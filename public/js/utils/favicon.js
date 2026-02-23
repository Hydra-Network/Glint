const faviconCache = new Map();
const CACHE_TTL = 1800000;

function checkFaviconExists(url, callback) {
  const cached = faviconCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    callback(cached.exists);
    return;
  }

  const img = new Image();
  let resolved = false;

  const cleanup = (exists) => {
    if (resolved) return;
    resolved = true;
    faviconCache.set(url, { exists, timestamp: Date.now() });
    callback(exists);
  };

  const timeout = setTimeout(() => cleanup(false), 1500);

  img.onload = () => {
    clearTimeout(timeout);
    cleanup(img.naturalWidth > 0 && img.naturalHeight > 0);
  };

  img.onerror = () => {
    clearTimeout(timeout);
    cleanup(false);
  };

  if (url.startsWith('http')) {
    img.crossOrigin = 'anonymous';
  }
  img.src = url;
}

function setTabFavicon(tabId, faviconUrl) {
  const tabs = window.tabs || {};
  if (!tabs[tabId]) return;

  tabs[tabId].favicon = faviconUrl;
  const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
  if (!tab) return;

  const placeholder = tab.querySelector('.tab-fav');
  if (placeholder) placeholder.remove();

  let favicon = tab.querySelector('.tab-favicon');
  if (!favicon) {
    favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    tab.insertBefore(favicon, tab.firstChild);
  }

  favicon.onerror = () => favicon.remove();
  favicon.src = faviconUrl;
}

function updateTabFaviconForUrl(tabId, url) {
  const tabs = window.tabs || {};
  if (!tabs[tabId]) return;
  
  tabs[tabId].faviconLoading = false;
  const originalUrl = window.getOriginalUrl(url);
  tabs[tabId].url = originalUrl;
  tabs[tabId].title = window.getWebsiteName(originalUrl);

  const tabTitle = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
  if (tabTitle) {
    tabTitle.textContent = tabs[tabId].title;
  }

  window.saveTabsToStorage();

  if (tabs[tabId].faviconLoading) return;

  try {
    const actualUrl = window.decodeProxiedUrl(url) || url;
    const actualHostname = new URL(actualUrl).hostname;

    tabs[tabId].faviconLoading = true;

    const faviconSources = [
      `/favicon-proxy?url=${encodeURIComponent(`https://www.google.com/s2/favicons?domain=${actualHostname}&sz=32`)}`,
      `/favicon-proxy?url=${encodeURIComponent(`https://icons.duckduckgo.com/ip3/${actualHostname}.ico`)}`
    ];

    let found = false;
    let pending = faviconSources.length;

    faviconSources.forEach((source, index) => {
      checkFaviconExists(source, (exists) => {
        pending--;
        
        if (found) return;
        
        if (exists && tabs[tabId]?.faviconLoading) {
          found = true;
          setTabFavicon(tabId, source);
          tabs[tabId].faviconLoading = false;
        } else if (pending === 0 && !found) {
          tabs[tabId].faviconLoading = false;
        }
      });
    });

  } catch (err) {
    if (tabs[tabId]) {
      tabs[tabId].faviconLoading = false;
    }
  }
}

function updateTabFavicon(tabId, frame) {
  const tabs = window.tabs || {};
  
  if (tabs[tabId]?.favicon && !tabs[tabId].favicon.includes('favicon-proxy')) {
    return;
  }
  if (tabs[tabId]?.faviconLoading) {
    return;
  }

  tabs[tabId].faviconLoading = false;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of faviconCache) {
    if (now - value.timestamp > CACHE_TTL) {
      faviconCache.delete(key);
    }
  }
}, 300000);

window.checkFaviconExists = checkFaviconExists;
window.setTabFavicon = setTabFavicon;
window.updateTabFaviconForUrl = updateTabFaviconForUrl;
window.updateTabFavicon = updateTabFavicon;
