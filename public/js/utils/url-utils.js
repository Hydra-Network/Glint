const urlDecodeCache = new Map();
const DECODE_CACHE_SIZE = 100;

function decodeProxiedUrl(proxiedUrl) {
  if (urlDecodeCache.has(proxiedUrl)) {
    return urlDecodeCache.get(proxiedUrl);
  }
  
  let result = null;
  
  try {
    const url = new URL(proxiedUrl);

    if (url.pathname.startsWith('/scramjet/')) {
      const encodedUrl = url.pathname.substring('/scramjet/'.length);
      if (encodedUrl) {
        try {
          const decoded = decodeURIComponent(encodedUrl);
          if (decoded.startsWith('http')) {
            result = decoded;
          } else {
            result = atob(encodedUrl);
          }
        } catch (e) {
          result = encodedUrl;
        }
      }
    } else if (url.searchParams.has('url')) {
      result = url.searchParams.get('url');
    } else {
      const pathMatch = url.pathname.match(/^\/proxy\/(.+)$/);
      if (pathMatch) {
        result = decodeURIComponent(pathMatch[1]);
      }
    }
  } catch (e) {
    result = null;
  }
  
  if (urlDecodeCache.size >= DECODE_CACHE_SIZE) {
    const firstKey = urlDecodeCache.keys().next().value;
    urlDecodeCache.delete(firstKey);
  }
  urlDecodeCache.set(proxiedUrl, result);
  
  return result;
}

function getOriginalUrl(url) {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (!url.includes('/scramjet/') || !url.includes(location.origin)) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname.startsWith('/scramjet/')) {
        const encodedUrl = urlObj.pathname.substring('/scramjet/'.length);
        try {
          const decoded = decodeURIComponent(encodedUrl);
          if (decoded.startsWith('http')) {
            if (decoded.includes('/scramjet/') && decoded.includes(location.origin)) {
              return getOriginalUrl(decoded);
            }
            return decoded;
          }
          const base64Decoded = atob(encodedUrl);
          if (base64Decoded.startsWith('http')) {
            return base64Decoded;
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
    return url;
  }

  const decoded = decodeProxiedUrl(url);
  if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) {
    if (decoded.includes('/scramjet/') && decoded.includes(location.origin)) {
      return getOriginalUrl(decoded);
    }
    return decoded;
  }

  if (url.includes('/scramjet/')) {
    try {
      const urlObj = new URL(url, location.origin);
      if (urlObj.pathname.startsWith('/scramjet/')) {
        const encodedUrl = urlObj.pathname.substring('/scramjet/'.length);
        try {
          const decoded = decodeURIComponent(encodedUrl);
          if (decoded.startsWith('http')) {
            return decoded;
          }
          const base64Decoded = atob(encodedUrl);
          if (base64Decoded.startsWith('http')) {
            return base64Decoded;
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
  }

  return url;
}

const websiteNameCache = new Map();

function getWebsiteName(url) {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return url || '';
  }
  
  if (websiteNameCache.has(url)) {
    return websiteNameCache.get(url);
  }

  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    websiteNameCache.set(url, hostname);
    
    if (websiteNameCache.size > 200) {
      const firstKey = websiteNameCache.keys().next().value;
      websiteNameCache.delete(firstKey);
    }
    
    return hostname;
  } catch (e) {
    const truncated = url.length > 20 ? url.substring(0, 20) + '...' : url;
    return truncated;
  }
}

let addressBarUpdateTimeout = null;

function updateAddressBar(url, tabId) {
  if (addressBarUpdateTimeout) {
    clearTimeout(addressBarUpdateTimeout);
  }
  
  addressBarUpdateTimeout = setTimeout(() => {
    try {
      const tabsRef = window.tabs || {};
      const urlInput = document.querySelector('.url-input');
      
      if (!url.startsWith(location.origin + '/scramjet/')) {
        return;
      }
      
      const displayUrl = decodeURIComponent(
        url.substring(location.origin.length + '/scramjet/'.length)
      );

      if (tabsRef && tabsRef[tabId]) {
        tabsRef[tabId].url = displayUrl;
        tabsRef[tabId].title = getWebsiteName(displayUrl);

        const tabTitle = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
        if (tabTitle) {
          tabTitle.textContent = tabsRef[tabId].title;
        }

        window.saveTabsToStorage?.();
      }

      if (urlInput && window.activeTabId === tabId) {
        urlInput.value = displayUrl;
      }
    } catch (e) {
      console.error('address bar update error:', e);
    }
    addressBarUpdateTimeout = null;
  }, 50);
}

window.decodeProxiedUrl = decodeProxiedUrl;
window.getOriginalUrl = getOriginalUrl;
window.getWebsiteName = getWebsiteName;
window.updateAddressBar = updateAddressBar;
