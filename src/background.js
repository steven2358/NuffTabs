// Background service worker - event handlers only

import { CURRENT_VERSION, DEFAULT_CONFIG, validateConfig } from './lib/config.js';
import { isVersionLessThan } from './lib/utils.js';
import {
  loadConfig,
  saveConfig,
  loadTabData,
  saveTabData,
  loadDiscardedTabs,
  saveVersion
} from './lib/storage.js';
import {
  initializeTabData,
  createTabMetadata,
  enforceTabLimit,
  updateBadge
} from './lib/tab-manager.js';

// In-memory state (reloaded from storage on service worker wake)
let config = null;
let tabData = null;
let discardedTabs = null;
let isInitialized = false;

/**
 * Ensures state is loaded from storage before any operation.
 * Must be called at the start of every event handler.
 */
async function ensureInitialized() {
  if (isInitialized) return;

  config = await loadConfig();
  tabData = await loadTabData();
  discardedTabs = await loadDiscardedTabs();

  // Always re-scan tabs to catch any that aren't tracked
  // (e.g., after service worker restart with empty session storage)
  tabData = await initializeTabData(tabData);

  isInitialized = true;
}

// ============================================================================
// Installation and Startup
// ============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await handleFirstInstall();
  } else if (details.reason === 'update') {
    await handleUpdate(details.previousVersion);
  }
});

async function handleFirstInstall() {
  // Clear any old data (important for unpacked extensions where storage persists)
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();

  // Set defaults
  config = { ...DEFAULT_CONFIG };
  discardedTabs = [];

  await saveConfig(config);
  await saveVersion();

  // Initialize tab data for existing tabs
  tabData = new Map();
  tabData = await initializeTabData(tabData);
  isInitialized = true;

  // DON'T enforce on first install - let user configure settings first
  // Enforcement will happen when user saves settings or opens a new tab
  await updateBadge(config);

  // Open welcome page
  chrome.tabs.create({ url: 'whatsnew.html' });
}

async function handleUpdate(previousVersion) {
  // CRITICAL: Load existing settings FIRST
  config = await loadConfig();
  tabData = await loadTabData();
  discardedTabs = await loadDiscardedTabs();

  // Preserve existing tab metadata, add new tabs
  tabData = await initializeTabData(tabData);

  // Version-specific migrations
  if (isVersionLessThan(previousVersion, '2.1.0')) {
    // v2.1.0: Validate and fix any corrupt config
    config = validateConfig(config);
    await saveConfig(config);
  }

  await saveVersion();
  isInitialized = true;

  // CRITICAL: Do NOT call enforceTabLimit() here!
  // User's existing tabs should be preserved on update.
  // Enforcement only happens when user creates new tabs.

  await updateBadge(config);

  // Open what's new page
  chrome.tabs.create({ url: 'whatsnew.html' });
}

// On browser startup, initialize state but don't enforce
// Enforcement happens when user creates new tabs or saves settings
chrome.runtime.onStartup.addListener(async () => {
  await ensureInitialized();
  await updateBadge(config);
});

// ============================================================================
// Tab Events
// ============================================================================

chrome.tabs.onCreated.addListener(async (newTab) => {
  await ensureInitialized();

  tabData.set(newTab.id, createTabMetadata());
  await saveTabData(tabData);

  discardedTabs = await enforceTabLimit(config, tabData, discardedTabs);
  await updateBadge(config);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ensureInitialized();

  tabData.delete(tabId);
  await saveTabData(tabData);
  await updateBadge(config);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await ensureInitialized();

  const now = Date.now();
  if (tabData.has(tabId)) {
    const data = tabData.get(tabId);
    data.lastAccessed = now;
    data.accessCount++;
  } else {
    tabData.set(tabId, createTabMetadata());
  }
  await saveTabData(tabData);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.pinned !== undefined) {
    await ensureInitialized();
    await updateBadge(config);
  }
});

// Update badge when tabs attach/detach (window moves)
chrome.tabs.onAttached.addListener(async () => {
  await ensureInitialized();
  await updateBadge(config);
});

chrome.tabs.onDetached.addListener(async () => {
  await ensureInitialized();
  await updateBadge(config);
});

// ============================================================================
// Active Time Tracking
// ============================================================================

// Track active time every 5 seconds (more efficient than 1 second)
setInterval(async () => {
  if (!isInitialized) return;

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && tabData.has(activeTab.id)) {
      const data = tabData.get(activeTab.id);
      data.totalActiveTime += 5000;
      await saveTabData(tabData);
    }
  } catch (e) {
    // Ignore errors (service worker may be shutting down)
  }
}, 5000);

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDiscardedTabs') {
    handleGetDiscardedTabs().then(sendResponse);
    return true; // Keep channel open for async response
  } else if (request.action === 'updateConfig') {
    handleUpdateConfig(request.config).then(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleGetDiscardedTabs() {
  await ensureInitialized();
  return { discardedTabs };
}

async function handleUpdateConfig(newConfig) {
  await ensureInitialized();

  // Validate and save
  config = validateConfig(newConfig);
  await saveConfig(config);

  // Update UI and enforce
  await updateBadge(config);
  discardedTabs = await enforceTabLimit(config, tabData, discardedTabs);

  return { success: true };
}
