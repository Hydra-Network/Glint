let saveTimeout = null;
let pendingSave = false;
const SAVE_DELAY = 500;

function saveTabsToStorage(immediate = false) {
  const tabs = window.tabs || {};
  const activeTabId = window.activeTabId || 'newtab';
  const tabCounter = window.tabCounter || 1;

  pendingSave = true;

  const performSave = () => {
    if (!pendingSave) return;
    pendingSave = false;
    
    try {
      const tabsData = {};
      
      for (const [tabId, tabData] of Object.entries(tabs)) {
        if (tabId === 'newtab' && !tabData.url) continue;
        
        const originalUrl = window.getOriginalUrl?.(tabData.url || '') || tabData.url || '';

        tabsData[tabId] = {
          url: originalUrl,
          title: tabData.title || 'New Tab',
          favicon: tabData.favicon || '',
          isNewTab: tabData.isNewTab || false
        };
      }
      
      const saveData = JSON.stringify(tabsData);
      localStorage.setItem('glint_tabs', saveData);
      localStorage.setItem('glint_activeTabId', activeTabId);
      localStorage.setItem('glint_tabCounter', String(tabCounter));
      
    } catch (e) {
      console.error('save tabs error:', e);
    }
    
    saveTimeout = null;
  };

  if (immediate) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    performSave();
  } else {
    if (!saveTimeout) {
      saveTimeout = setTimeout(performSave, SAVE_DELAY);
    }
  }
}

function restoreTabsFromStorage(createTabElement, initializeTab, createProxyFrame) {
  const tabs = window.tabs || {};
  const tabsContainer = document.querySelector(".tabs");

  try {
    const savedTabs = localStorage.getItem('glint_tabs');
    const savedActiveTabId = localStorage.getItem('glint_activeTabId');
    const savedTabCounter = localStorage.getItem('glint_tabCounter');

    if (savedTabCounter) {
      window.tabCounter = parseInt(savedTabCounter, 10) || 1;
    }

    if (!savedTabs) {
      tabs['newtab'] = {
        url: '',
        title: 'New Tab',
        favicon: '',
        isNewTab: true
      };
      return { tabs, activeTabId: 'newtab' };
    }
    
    const tabsData = JSON.parse(savedTabs);
    
    if (Object.keys(tabsData).length === 0) {
      tabs['newtab'] = {
        url: '',
        title: 'New Tab',
        favicon: '',
        isNewTab: true
      };
      return { tabs, activeTabId: 'newtab' };
    }
    
    const existingNewTab = document.querySelector('.tab[data-tab-id="newtab"]');
    if (existingNewTab) {
      existingNewTab.remove();
      delete tabs['newtab'];
      const newTabFrame = document.getElementById('frame-newtab');
      if (newTabFrame) newTabFrame.remove();
    }

    for (const [tabId, tabData] of Object.entries(tabsData)) {
      tabs[tabId] = { ...tabData, isHistoryNavigation: false };

      if (!window.tabHistory[tabId]) {
        window.tabHistory[tabId] = [];
        window.tabHistory[tabId].historyIndex = -1;
      }

      if (tabData.url?.startsWith('http://') || tabData.url?.startsWith('https://')) {
        window.addToHistory?.(tabId, tabData.url);
      }

      const newTabElement = createTabElement(tabId, tabData);
      tabsContainer.insertBefore(newTabElement, document.querySelector('.add-tab'));
      initializeTab(newTabElement);

      createProxyFrame(tabId);

      if (tabData.url && !tabData.isNewTab) {
        if (tabData.url.startsWith('http://') || tabData.url.startsWith('https://')) {
          tabs[tabId].pendingUrl = tabData.url;
        }
      }
    }

    if (savedActiveTabId && tabs[savedActiveTabId]) {
      window.activeTabId = savedActiveTabId;
    } else if (Object.keys(tabs).length > 0) {
      window.activeTabId = Object.keys(tabs)[0];
    }

  } catch (e) {
    console.error('restore tabs error:', e);
    tabs['newtab'] = {
      url: '',
      title: 'New Tab',
      favicon: '',
      isNewTab: true
    };
  }

  return {
    tabs,
    activeTabId: window.activeTabId || 'newtab'
  };
}

window.addEventListener('beforeunload', () => {
  if (pendingSave) {
    saveTabsToStorage(true);
  }
});

window.saveTabsToStorage = saveTabsToStorage;
window.restoreTabsFromStorage = restoreTabsFromStorage;
