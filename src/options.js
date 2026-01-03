document.addEventListener('DOMContentLoaded', () => {
  const maxTabsSelect = document.getElementById('maxTabs');
  const discardCriterionSelect = document.getElementById('discardCriterion');
  const ignorePinnedSelect = document.getElementById('ignorePinned');
  const showCountSelect = document.getElementById('showCount');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load saved options
  chrome.storage.local.get(['config'], (result) => {
    if (result.config) {
      maxTabsSelect.value = result.config.maxTabs;
      discardCriterionSelect.value = result.config.discardCriterion;
      // Convert booleans to strings for select elements
      ignorePinnedSelect.value = String(result.config.ignorePinned);
      showCountSelect.value = String(result.config.showCount);
    }
  });

  // Save options with proper async handling
  saveButton.addEventListener('click', async () => {
    const config = {
      maxTabs: parseInt(maxTabsSelect.value, 10),
      discardCriterion: discardCriterionSelect.value,
      ignorePinned: ignorePinnedSelect.value === 'true',
      showCount: showCountSelect.value === 'true',
      enabled: true  // Enable enforcement when user saves
    };

    // Disable button during save
    saveButton.disabled = true;
    statusDiv.textContent = 'Saving...';
    statusDiv.style.color = '#666';

    try {
      // Save to storage first
      await chrome.storage.local.set({ config });

      // Notify background script and wait for confirmation
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'updateConfig', config }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve();
          } else {
            reject(new Error('Failed to update config'));
          }
        });
      });

      statusDiv.textContent = 'Options saved!';
      statusDiv.style.color = 'green';
    } catch (error) {
      console.error('Save error:', error);
      statusDiv.textContent = 'Error saving. Please try again.';
      statusDiv.style.color = 'red';
    } finally {
      saveButton.disabled = false;
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    }
  });
});
