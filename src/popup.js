(() => {
  const tabsPerPage = 10;
  let discardedTabs = [];
  let currentPage = 0;

  const tabList = document.getElementById('tabList');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const optionsLink = document.getElementById('optionsLink');

  function updateTabList() {
    const fragment = document.createDocumentFragment();
    const start = currentPage * tabsPerPage;
    const end = Math.min(start + tabsPerPage, discardedTabs.length);

    for (let i = start; i < end; i++) {
      const { url, title } = discardedTabs[i];
      if (!url) continue;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url;
      a.textContent = title || '[Untitled]';
      a.title = url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url });
      });
      li.appendChild(a);
      fragment.appendChild(li);
    }

    tabList.innerHTML = '';
    tabList.appendChild(fragment);
    tabList.start = start + 1;

    prevButton.disabled = currentPage === 0;
    nextButton.disabled = end >= discardedTabs.length;
  }

  function changePage(delta) {
    currentPage += delta;
    updateTabList();
  }

  // Load discarded tabs with error handling
  chrome.runtime.sendMessage({ action: 'getDiscardedTabs' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading discarded tabs:', chrome.runtime.lastError);
      return;
    }
    discardedTabs = response?.discardedTabs || [];
    updateTabList();
  });

  prevButton.addEventListener('click', () => changePage(-1));
  nextButton.addEventListener('click', () => changePage(1));

  // Fixed: add preventDefault to prevent any default link behavior
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
})();
