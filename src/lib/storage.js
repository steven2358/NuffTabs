// Storage abstraction with proper async/await handling

import { DEFAULT_CONFIG, validateConfig, CURRENT_VERSION } from './config.js';

/**
 * Loads config from storage, merging with defaults and validating.
 * @returns {Promise<object>} Valid config object
 */
export async function loadConfig() {
  const result = await chrome.storage.local.get(['config']);
  const merged = { ...DEFAULT_CONFIG, ...result.config };
  return validateConfig(merged);
}

/**
 * Saves config to storage. Awaits completion.
 * @param {object} config - Config to save
 */
export async function saveConfig(config) {
  await chrome.storage.local.set({ config });
}

/**
 * Loads tab metadata from session storage (survives service worker restarts).
 * @returns {Promise<Map>} Map of tabId -> metadata
 */
export async function loadTabData() {
  try {
    const result = await chrome.storage.session.get(['tabData']);
    if (result.tabData && typeof result.tabData === 'object') {
      return new Map(Object.entries(result.tabData).map(([k, v]) => [parseInt(k, 10), v]));
    }
  } catch (e) {
    // session storage might not be available in older Chrome versions
    console.warn('Session storage not available, using memory only');
  }
  return new Map();
}

/**
 * Saves tab metadata to session storage. Awaits completion.
 * @param {Map} tabData - Map of tabId -> metadata
 */
export async function saveTabData(tabData) {
  try {
    const obj = Object.fromEntries(tabData);
    await chrome.storage.session.set({ tabData: obj });
  } catch (e) {
    // session storage might not be available
    console.warn('Could not save tab data to session storage');
  }
}

/**
 * Loads discarded tabs history from storage.
 * @returns {Promise<Array>} Array of discarded tab objects
 */
export async function loadDiscardedTabs() {
  const result = await chrome.storage.local.get(['discardedTabs']);
  if (Array.isArray(result.discardedTabs)) {
    return result.discardedTabs;
  }
  return [];
}

/**
 * Saves discarded tabs history to storage. Awaits completion.
 * @param {Array} discardedTabs - Array of discarded tab objects
 */
export async function saveDiscardedTabs(discardedTabs) {
  await chrome.storage.local.set({ discardedTabs });
}

/**
 * Adds a closed tab to the discarded tabs history (max 100 items).
 * @param {object} tab - Tab object with url and title
 * @param {Array} discardedTabs - Current discarded tabs array
 * @returns {Promise<Array>} Updated discarded tabs array
 */
export async function addDiscardedTab(tab, discardedTabs) {
  if (!tab.url) {
    return discardedTabs;
  }

  const updated = [
    { url: tab.url, title: tab.title || '[Untitled]' },
    ...discardedTabs
  ].slice(0, 100);

  await saveDiscardedTabs(updated);
  return updated;
}

/**
 * Loads the stored version number.
 * @returns {Promise<string|null>} Stored version or null
 */
export async function loadVersion() {
  const result = await chrome.storage.local.get(['version']);
  return result.version || null;
}

/**
 * Saves the current version number.
 */
export async function saveVersion() {
  await chrome.storage.local.set({ version: CURRENT_VERSION });
}
