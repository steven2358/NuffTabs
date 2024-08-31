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
      ignorePinnedSelect.value = result.config.ignorePinned;
      showCountSelect.value = result.config.showCount;
    }
  });

  // Save options
  saveButton.addEventListener('click', () => {
    const config = {
      maxTabs: parseInt(maxTabsSelect.value),
      discardCriterion: discardCriterionSelect.value,
      ignorePinned: ignorePinnedSelect.value === 'true',
      showCount: showCountSelect.value === 'true'
    };

    chrome.storage.local.set({ config }, () => {
      chrome.runtime.sendMessage({ action: 'updateConfig', config });
      statusDiv.textContent = 'Options saved!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});