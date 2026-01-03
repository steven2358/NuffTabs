// Configuration constants and validation

export const CURRENT_VERSION = '2.1.0';

export const NORMAL_BADGE_COLOR = '#4688F1';  // blue
export const LIMIT_REACHED_COLOR = '#E57373'; // soft red

export const DEFAULT_CONFIG = {
  maxTabs: 10,
  discardCriterion: 'oldest',
  ignorePinned: true,
  showCount: true,
  enabled: false  // Only enforce after user explicitly saves settings
};

export const VALID_CRITERIA = ['oldest', 'newest', 'LRO', 'LFU', 'random'];

/**
 * Validates and sanitizes a config object, filling in defaults for missing/invalid values.
 * @param {object} config - The config to validate
 * @returns {object} A valid config object
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  return {
    maxTabs: validateMaxTabs(config.maxTabs),
    discardCriterion: validateCriterion(config.discardCriterion),
    ignorePinned: typeof config.ignorePinned === 'boolean' ? config.ignorePinned : DEFAULT_CONFIG.ignorePinned,
    showCount: typeof config.showCount === 'boolean' ? config.showCount : DEFAULT_CONFIG.showCount,
    enabled: typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_CONFIG.enabled
  };
}

function validateMaxTabs(value) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1) {
    return DEFAULT_CONFIG.maxTabs;
  }
  return num;
}

function validateCriterion(value) {
  if (VALID_CRITERIA.includes(value)) {
    return value;
  }
  return DEFAULT_CONFIG.discardCriterion;
}
