function createProxyFrame(tabId, container) {
  const frame = document.createElement('iframe');
  frame.id = `frame-${tabId}`;
  frame.className = 'frame';
  frame.style.cssText = 'display:none;border:none;width:100%;height:calc(100vh - 92px);pointer-events:auto;position:relative;z-index:10;overflow:auto';
  
  frame.setAttribute('loading', 'eager');
  frame.setAttribute('scrolling', 'yes');
  frame.setAttribute('allowtransparency', 'true');
  frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');

  container.appendChild(frame);
  frame.classList.add('loading');

  const handleLoad = () => {
    frame.classList.remove('loading');
    window.updateTabFavicon(tabId, frame);

    try {
      const frameWindow = frame.contentWindow;
      if (frameWindow && frame.src) {
        const currentURL = frameWindow.location.href;
        window.updateAddressBar(currentURL, tabId);
        window.updateTabFaviconForUrl(tabId, currentURL);

        const tabs = window.tabs || {};
        if (tabs[tabId] && !tabs[tabId].isNewTab && frame.src) {
          cleanupNavigationMonitor(tabId);
          window.startIframeNavigationMonitor(frame, tabId);
        }
      }
    } catch (e) {
    }
  };

  frame.onload = handleLoad;
  return frame;
}

function cleanupNavigationMonitor(tabId) {
  const tabs = window.tabs || {};
  if (tabs[tabId]?.navigationMonitor) {
    clearInterval(tabs[tabId].navigationMonitor);
    tabs[tabId].navigationMonitor = null;
  }
}

function startIframeNavigationMonitor(iframe, tabId) {
  const tabs = window.tabs || {};
  let lastUrl = '';
  let consecutiveFailures = 0;
  const MAX_FAILURES = 5;
  const POLL_INTERVAL = 1000;

  const checkForNavigation = () => {
    try {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow || !tabs[tabId]) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          cleanupNavigationMonitor(tabId);
        }
        return;
      }

      consecutiveFailures = 0;
      const currentURL = frameWindow.location.href;

      if (currentURL && currentURL !== lastUrl && currentURL !== 'about:blank') {
        lastUrl = currentURL;
        
        requestAnimationFrame(() => {
          window.updateAddressBar(currentURL, tabId);
          window.updateTabFaviconForUrl(tabId, currentURL);

          if (tabs[tabId]) {
            const originalUrl = window.getOriginalUrl(currentURL);
            tabs[tabId].url = originalUrl;

            if (!tabs[tabId].isHistoryNavigation) {
              window.addToHistory(tabId, originalUrl);
            }

            tabs[tabId].title = window.getWebsiteName(originalUrl);

            const tabTitle = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
            if (tabTitle) {
              tabTitle.textContent = tabs[tabId].title;
            }

            window.saveTabsToStorage();
          }
        });
      }
    } catch (e) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_FAILURES) {
        cleanupNavigationMonitor(tabId);
      }
    }
  };

  cleanupNavigationMonitor(tabId);

  const monitorInterval = setInterval(checkForNavigation, POLL_INTERVAL);

  if (!tabs[tabId]) tabs[tabId] = {};
  tabs[tabId].navigationMonitor = monitorInterval;

  checkForNavigation();
}

window.addEventListener('beforeunload', () => {
  const tabs = window.tabs || {};
  for (const tabId of Object.keys(tabs)) {
    cleanupNavigationMonitor(tabId);
  }
});

window.createProxyFrame = createProxyFrame;
window.startIframeNavigationMonitor = startIframeNavigationMonitor;
window.cleanupNavigationMonitor = cleanupNavigationMonitor;
