// Utility functions

/**
 * Compares two semantic version strings.
 * @param {string} v1 - First version (e.g., '2.1.0')
 * @param {string} v2 - Second version (e.g., '2.0.0')
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1, v2) {
  const parts1 = (v1 || '0.0.0').split('.').map(Number);
  const parts2 = (v2 || '0.0.0').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * Returns true if v1 is less than v2.
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {boolean}
 */
export function isVersionLessThan(v1, v2) {
  return compareVersions(v1, v2) < 0;
}
