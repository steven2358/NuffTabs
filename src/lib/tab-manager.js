// Tab tracking and enforcement logic

import { NORMAL_BADGE_COLOR, LIMIT_REACHED_COLOR } from './config.js';
import { saveTabData, addDiscardedTab } from './storage.js';

/**
 * Initializes tab data, preserving existing metadata and adding new tabs.
 * Removes entries for tabs that no longer exist.
 * @param {Map} tabData - Existing tab data
 * @returns {Promise<Map>} Updated tab data
 */
export async function initializeTabData(tabData) {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  const currentTabIds = new Set(tabs.map(t => t.id));

  // Remove entries for tabs that no longer exist
  for (const tabId of tabData.keys()) {
    if (!currentTabIds.has(tabId)) {
      tabData.delete(tabId);
    }
  }

  // Add entries for new tabs (preserving existing data!)
  // Use tab index as proxy for age: lower index = older tab
  // Spread timestamps by 1 second per tab to establish order
  const numNewTabs = tabs.filter(t => !tabData.has(t.id)).length;
  let offsetIndex = 0;

  for (const tab of tabs) {
    if (!tabData.has(tab.id)) {
      // Earlier tabs get earlier timestamps (older)
      const created = now - ((numNewTabs - offsetIndex) * 1000);
      tabData.set(tab.id, {
        created,
        lastAccessed: now,
        accessCount: 1,
        totalActiveTime: 0
      });
      offsetIndex++;
    }
  }

  await saveTabData(tabData);
  return tabData;
}

/**
 * Creates metadata for a new tab.
 * @returns {object} Tab metadata
 */
export function createTabMetadata() {
  const now = Date.now();
  return {
    created: now,
    lastAccessed: now,
    accessCount: 1,
    totalActiveTime: 0
  };
}

/**
 * Selects a tab to close based on the configured criterion.
 * Never selects the active tab or tabs without metadata.
 * @param {Array} tabs - Array of tab objects
 * @param {Map} tabData - Tab metadata map
 * @param {string} criterion - Selection criterion (oldest, newest, LRO, LFU, random)
 * @returns {object|null} Tab to close, or null if none available
 */
export function selectTabToClose(tabs, tabData, criterion) {
  // Filter to valid candidates: has metadata, not active
  const validTabs = tabs.filter(tab => {
    if (tab.active) return false;
    if (!tabData.has(tab.id)) return false;
    return true;
  });

  if (validTabs.length === 0) {
    return null;
  }

  switch (criterion) {
    case 'oldest':
      return validTabs.reduce((oldest, tab) => {
        if (!oldest) return tab;
        const oldestData = tabData.get(oldest.id);
        const tabDataEntry = tabData.get(tab.id);
        return tabDataEntry.created < oldestData.created ? tab : oldest;
      }, null);

    case 'newest':
      return validTabs.reduce((newest, tab) => {
        if (!newest) return tab;
        const newestData = tabData.get(newest.id);
        const tabDataEntry = tabData.get(tab.id);
        return tabDataEntry.created > newestData.created ? tab : newest;
      }, null);

    case 'LRO': // Least Recently Used (by access time)
      return validTabs.reduce((lru, tab) => {
        if (!lru) return tab;
        const lruData = tabData.get(lru.id);
        const tabDataEntry = tabData.get(tab.id);
        return tabDataEntry.lastAccessed < lruData.lastAccessed ? tab : lru;
      }, null);

    case 'LFU': // Least Frequently Used (by total active time)
      return validTabs.reduce((lfu, tab) => {
        if (!lfu) return tab;
        const lfuData = tabData.get(lfu.id);
        const tabDataEntry = tabData.get(tab.id);
        return tabDataEntry.totalActiveTime < lfuData.totalActiveTime ? tab : lfu;
      }, null);

    case 'random':
      return validTabs[Math.floor(Math.random() * validTabs.length)];

    default:
      return validTabs[0];
  }
}

/**
 * Enforces the tab limit by closing excess tabs.
 * Only enforces if config.enabled is true (user has saved settings).
 * @param {object} config - Current config
 * @param {Map} tabData - Tab metadata
 * @param {Array} discardedTabs - Discarded tabs history
 * @returns {Promise<Array>} Updated discarded tabs array
 */
export async function enforceTabLimit(config, tabData, discardedTabs) {
  // Don't enforce until user has explicitly saved settings
  if (!config.enabled) {
    return discardedTabs;
  }

  const tabs = await chrome.tabs.query({});
  const validTabs = config.ignorePinned ? tabs.filter(tab => !tab.pinned) : [...tabs];
  const excess = validTabs.length - config.maxTabs;

  if (excess <= 0) {
    return discardedTabs;
  }

  let closedCount = 0;
  let updatedDiscardedTabs = discardedTabs;

  for (let i = 0; i < excess; i++) {
    const tabToClose = selectTabToClose(validTabs, tabData, config.discardCriterion);

    if (!tabToClose) {
      // No valid candidate (e.g., all remaining tabs are active or have no metadata)
      break;
    }

    // Record before closing
    updatedDiscardedTabs = await addDiscardedTab(tabToClose, updatedDiscardedTabs);

    // Remove from tracking
    tabData.delete(tabToClose.id);

    // Remove from our working array
    const idx = validTabs.findIndex(t => t.id === tabToClose.id);
    if (idx !== -1) {
      validTabs.splice(idx, 1);
    }

    // Close the tab
    try {
      await chrome.tabs.remove(tabToClose.id);
      closedCount++;
    } catch (e) {
      // Tab may have been closed already
      console.warn('Could not close tab:', e);
    }
  }

  // Save updated tab data
  await saveTabData(tabData);

  // Notify user if tabs were closed
  if (closedCount > 0) {
    notifyTabClosed();
  }

  return updatedDiscardedTabs;
}

/**
 * Shows a brief alert icon when a tab is closed.
 */
function notifyTabClosed() {
  chrome.action.setIcon({ path: 'i/icon_alert.png' });
  setTimeout(() => {
    chrome.action.setIcon({ path: 'i/icon48.png' });
  }, 500);
}

/**
 * Gets the count of valid tabs (respecting ignorePinned setting).
 * @param {object} config - Current config
 * @returns {Promise<number>} Tab count
 */
export async function getValidTabCount(config) {
  const tabs = await chrome.tabs.query({});
  return config.ignorePinned ? tabs.filter(tab => !tab.pinned).length : tabs.length;
}

/**
 * Updates the badge with current tab count.
 * @param {object} config - Current config
 */
export async function updateBadge(config) {
  if (config.showCount) {
    const count = await getValidTabCount(config);
    chrome.action.setBadgeText({ text: count.toString() });

    const color = count >= config.maxTabs ? LIMIT_REACHED_COLOR : NORMAL_BADGE_COLOR;
    chrome.action.setBadgeBackgroundColor({ color });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
