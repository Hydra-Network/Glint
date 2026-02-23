document.addEventListener('DOMContentLoaded', () => {
  const mainSearchInput = document.querySelector('.main-search-input');
  const addressBarInput = document.querySelector('.address-bar-input');

  function processSearch(searchTerm) {
    if (!searchTerm) return;

    const settings = window.glintSettings || {};
    const currentEngine = settings.searchEngine || 'google';
    const searchEngines = settings.searchEngines || {
      google: 'https://www.google.com/search?q=%s',
      blank: 'about:blank'
    };

    let searchUrl;

    if (searchTerm.includes('.') && !searchTerm.includes(' ')) {
      if (!searchTerm.startsWith('http://') && !searchTerm.startsWith('https://')) {
        searchTerm = 'https://' + searchTerm;
      }
      searchUrl = searchTerm;
    }
    else if (currentEngine === 'blank') {
      searchUrl = 'about:blank';
    }
    else {
      const engineUrl = searchEngines[currentEngine] || searchEngines.google;
      searchUrl = engineUrl.replace('%s', encodeURIComponent(searchTerm));
    }

    window.dispatchEvent(new CustomEvent('glint:search', {
      detail: { searchTerm: searchTerm, searchUrl: searchUrl }
    }));
  }

  mainSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchTerm = mainSearchInput.value.trim();
      if (addressBarInput) {
        addressBarInput.value = searchTerm;
      }
      processSearch(searchTerm);
    }
  });

  addressBarInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchTerm = addressBarInput.value.trim();
      processSearch(searchTerm);
    }
  });

  mainSearchInput.addEventListener('focus', () => {
    mainSearchInput.classList.add('focused');
  });

  mainSearchInput.addEventListener('blur', () => {
    mainSearchInput.classList.remove('focused');
  });

  window.addEventListener('glint:settings-updated', () => {});

  document.querySelectorAll('.shortcut[data-url]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const url = el.getAttribute('data-url');
      if (!url) return;
      if (window.navigateTo) {
        const tabId = window.activeTabId || 'newtab';
        window.navigateTo(url, tabId);
      }
    });
  });
});
