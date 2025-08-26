// settings.js

const SETTINGS_KEY = 'aasa-settings'; // (unchanged)

// ---- Keep existing API exactly the same ----

// Update currentModel in local settings, then mirror to sync { lmStudioURL, model }
export function setCurrentModel(modelName) {
  loadSettings(settings => {
    const next = { ...settings, currentModel: modelName };
    saveSettings(next);            // local
    mirrorToWorkerSync(next);      // sync mirror for service worker
  });
}

// Read currentModel; keep original default
export function getCurrentModel(callback) {
  loadSettings(settings => callback(settings.currentModel || 'DeepSeek R1'));
}

document.getElementById('testConnectionBtn').addEventListener('click', async () => {
  const btn = document.getElementById('testConnectionBtn');
  btn.textContent = '🟡 Testing...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
    btn.textContent = response?.success ? '🟢 Connected' : '🔴 Failed';
  } catch {
    btn.textContent = '🔴 Error';
  }

  setTimeout(() => { btn.textContent = 'Test Connection'; }, 3000);
});

// Save current settings (local) + mirror to sync that the worker reads
export function saveSettings(settings) {
  chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
    console.log('[✅ settings.js] Settings saved (local):', settings);
    mirrorToWorkerSync(settings); // ensure worker sees latest model/url
  });
}

// Load settings and run a callback (unchanged)
export function loadSettings(callback) {
  chrome.storage.local.get([SETTINGS_KEY], (result) => {
    const settings = result[SETTINGS_KEY] || {};
    console.log('[📦 settings.js] Loaded settings (local):', settings);
    callback(settings);
  });
}

// Clear all data (including history and settings)
export function clearAllData() {
  chrome.storage.local.clear(() => {
    console.log('[🧹 settings.js] All local data cleared.');
  });
  // also clear the worker's sync settings key it expects
  chrome.storage.sync.remove('settings', () => {
    console.log('[🧹 settings.js] Sync settings cleared.');
  });
}

// Optional: Get just one value (e.g. model) from current settings (unchanged)
export function getSetting(key, callback) {
  loadSettings((settings) => {
    callback(settings[key]);
  });
}

// ---- UI: Dark mode toggle (unchanged) ----
document.addEventListener('DOMContentLoaded', () => {
  const darkToggle = document.getElementById('darkModeToggle');

  const isDark = localStorage.getItem('dark-mode') === 'true';
  darkToggle.checked = isDark;
  document.body.classList.toggle('dark-mode', isDark);

  darkToggle.addEventListener('change', () => {
    const enabled = darkToggle.checked;
    document.body.classList.toggle('dark-mode', enabled);
    localStorage.setItem('dark-mode', enabled);
  });
});

// ---- Internal helper: mirror local UI settings to worker's expected sync schema ----
// Worker expects chrome.storage.sync.get('settings') -> { lmStudioURL, model }
function mirrorToWorkerSync(localSettings = {}) {
  const lmStudioURL = localSettings.lmStudioURL || 'http://localhost:1234';
  const model       = localSettings.currentModel || 'openai/gpt-oss-20b';
  chrome.storage.sync.set({ settings: { lmStudioURL, model } }, () => {
    console.log('[🔄 settings.js] Mirrored to sync for worker:', { lmStudioURL, model });
  });
}
// add this in settings.js
export function setLmStudioURL(url) {
  loadSettings(settings => {
    const next = { ...settings, lmStudioURL: url };
    saveSettings(next);          // local
    mirrorToWorkerSync(next);    // sync mirror for service worker
  });
}
