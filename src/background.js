const CURRENT_VERSION = '2.0.0';
const NORMAL_BADGE_COLOR = '#4688F1';  // blue
const LIMIT_REACHED_COLOR = '#E57373';  // soft red

let config = {
  maxTabs: 10,
  discardCriterion: 'oldest',
  ignorePinned: true,
  showCount: true
};

const tabData = new Map();
let discardedTabs = [];

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await handleFirstInstall();
    openWhatsNewPage();
  } else if (details.reason === 'update') {
    await handleUpdate(details.previousVersion);
    openWhatsNewPage();
  }
});

function openWhatsNewPage() {
  chrome.tabs.create({ url: 'whatsnew.html' });
}

async function handleFirstInstall() {
  await chrome.storage.local.set({ config, discardedTabs, version: CURRENT_VERSION });
  await initializeTabData();
  await enforceTabLimit();
}

async function handleUpdate(previousVersion) {
  const result = await chrome.storage.local.get(['config', 'discardedTabs', 'version']);
  
  if (result.config) {
    config = { ...config, ...result.config };
  }
  if (result.discardedTabs) {
    discardedTabs = result.discardedTabs;
  }
  
  // Version-specific updates
  if (previousVersion < '2.0.0') {
    // Perform any necessary data migrations for pre-2.0.0 versions
  }
  
  // Add more version checks here for future updates
  // if (previousVersion < '2.1.0') { ... }
  
  await chrome.storage.local.set({ config, discardedTabs, version: CURRENT_VERSION });
  await initializeTabData();
  await enforceTabLimit();
}

chrome.runtime.onStartup.addListener(async () => {
  await initializeTabData();
  await enforceTabLimit();
});

async function initializeTabData() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  tabData.clear();
  tabs.forEach(tab => {
    tabData.set(tab.id, { created: now, lastAccessed: now, accessCount: 1, totalActiveTime: 0 });
  });
  updateBadge();
}

async function enforceTabLimit() {
  const tabs = await chrome.tabs.query({});
  const validTabs = config.ignorePinned ? tabs.filter(tab => !tab.pinned) : tabs;
  const excessTabs = validTabs.length - config.maxTabs;
  
  if (excessTabs > 0) {
    for (let i = 0; i < excessTabs; i++) {
      const tabToClose = await selectTabToClose(validTabs);
      if (tabToClose) {
        await closeTab(tabToClose);
        validTabs.splice(validTabs.findIndex(tab => tab.id === tabToClose.id), 1);
      }
    }
  }
  
  updateBadge();
}

async function getValidTabCount() {
  const tabs = await chrome.tabs.query({});
  return config.ignorePinned ? tabs.filter(tab => !tab.pinned).length : tabs.length;
}

async function updateBadge() {
  if (config.showCount) {
    const count = await getValidTabCount();
    chrome.action.setBadgeText({ text: count.toString() });
    const color = await getBadgeColor(count);
    chrome.action.setBadgeBackgroundColor({ color: color });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function getBadgeColor(tabCount) {
  const validTabCount = await getValidTabCount();
  return validTabCount >= config.maxTabs ? LIMIT_REACHED_COLOR : NORMAL_BADGE_COLOR;
}

chrome.tabs.onCreated.addListener(async (newTab) => {
  const now = Date.now();
  tabData.set(newTab.id, { created: now, lastAccessed: now, accessCount: 1, totalActiveTime: 0 });
  await enforceTabLimit();
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabData.delete(tabId);
  updateBadge();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.pinned !== undefined) {
    updateBadge();
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const now = Date.now();
  if (tabData.has(tabId)) {
    const data = tabData.get(tabId);
    data.lastAccessed = now;
    data.accessCount++;
  } else {
    tabData.set(tabId, { created: now, lastAccessed: now, accessCount: 1, totalActiveTime: 0 });
  }
});

setInterval(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const tabId = tabs[0].id;
      if (tabData.has(tabId)) {
        const data = tabData.get(tabId);
        data.totalActiveTime += 1000;
      }
    }
  });
}, 1000);

async function selectTabToClose(tabs, excludeTabId) {
  const validTabs = tabs.filter(tab => tab.id !== excludeTabId);
  switch (config.discardCriterion) {
    case 'oldest':
      return validTabs.reduce((oldest, tab) => 
        (!oldest || (tabData.get(tab.id).created < tabData.get(oldest.id).created)) ? tab : oldest
      );
    case 'newest':
      return validTabs.reduce((newest, tab) => 
        (!newest || (tabData.get(tab.id).created > tabData.get(newest.id).created)) ? tab : newest
      );
    case 'LRO':
      return validTabs.reduce((lro, tab) => 
        (!lro || (tabData.get(tab.id).lastAccessed < tabData.get(lro.id).lastAccessed)) ? tab : lro
      );
    case 'LFU':
      return validTabs.reduce((lfu, tab) => 
        (!lfu || (tabData.get(tab.id).totalActiveTime < tabData.get(lfu.id).totalActiveTime)) ? tab : lfu
      );
    case 'random':
      return validTabs[Math.floor(Math.random() * validTabs.length)];
  }
}

async function closeTab(tab) {
  if (tab.url) {
    discardedTabs.unshift({ id: tab.id, url: tab.url, title: tab.title || "[Untitled]" });
    if (discardedTabs.length > 100) discardedTabs.pop();
    await chrome.storage.local.set({ discardedTabs });
  }
  await chrome.tabs.remove(tab.id);
  tabData.delete(tab.id);
  notifyTabClosed();
}

function notifyTabClosed() {
  chrome.action.setIcon({ path: 'i/icon_alert.png' });
  setTimeout(() => chrome.action.setIcon({ path: 'i/icon48.png' }), 500);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDiscardedTabs') {
    sendResponse({ discardedTabs });
  } else if (request.action === 'updateConfig') {
    config = request.config;
    chrome.storage.local.set({ config });
    updateBadge();
    enforceTabLimit();
  }
});

['onAttached', 'onDetached', 'onCreated', 'onRemoved'].forEach(event => {
  chrome.tabs[event].addListener(updateBadge);
});