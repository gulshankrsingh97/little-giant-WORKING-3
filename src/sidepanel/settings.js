// settings.js

const SETTINGS_KEY = 'aasa-settings';

document.getElementById('testConnectionBtn').addEventListener('click', async () => {
    const btn = document.getElementById('testConnectionBtn');
    btn.textContent = '🟡 Testing...';

    try {
        const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });

        if (response?.success) {
            btn.textContent = '🟢 Connected';
        } else {
            btn.textContent = '🔴 Failed';
        }
    } catch (err) {
        btn.textContent = '🔴 Error';
    }

    setTimeout(() => {
        btn.textContent = 'Test Connection';
    }, 3000);
});


// Save current settings
export function saveSettings(settings) {
  chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
    console.log('[✅ settings.js] Settings saved:', settings);
  });
}

// Load settings and run a callback
export function loadSettings(callback) {
  chrome.storage.local.get([SETTINGS_KEY], (result) => {
    const settings = result[SETTINGS_KEY] || {};
    console.log('[📦 settings.js] Loaded settings:', settings);
    callback(settings);
  });
}

// Clear all data (including history and settings)
export function clearAllData() {
  chrome.storage.local.clear(() => {
    console.log('[🧹 settings.js] All data cleared.');
  });
}

// Optional: Get just one value (e.g. model) from current settings
export function getSetting(key, callback) {
  loadSettings((settings) => {
    callback(settings[key]);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const darkToggle = document.getElementById('darkModeToggle');

  // Load persisted setting
  const isDark = localStorage.getItem('dark-mode') === 'true';
  darkToggle.checked = isDark;
  document.body.classList.toggle('dark-mode', isDark);

  // Toggle logic
  darkToggle.addEventListener('change', () => {
    const enabled = darkToggle.checked;
    document.body.classList.toggle('dark-mode', enabled);
    localStorage.setItem('dark-mode', enabled);
  });
});
