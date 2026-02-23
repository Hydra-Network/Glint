document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search-input');
  const urlInput = document.querySelector('.url-input');

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

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchTerm = searchInput.value.trim();
      if (urlInput) {
        urlInput.value = searchTerm;
      }
      processSearch(searchTerm);
    }
  });

  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchTerm = urlInput.value.trim();
      processSearch(searchTerm);
    }
  });

  searchInput.addEventListener('focus', () => {
    searchInput.classList.add('focused');
  });

  searchInput.addEventListener('blur', () => {
    searchInput.classList.remove('focused');
  });

  window.addEventListener('glint:settings-updated', () => {});

  document.querySelectorAll('.qlink[data-url]').forEach((el) => {
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
