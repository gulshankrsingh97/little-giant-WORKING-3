// src/background/history.js

const STORAGE_KEY = 'chatHistory';

// Save a message to local history
export function saveHistory(message) {
  if (!message) return;
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const list = result[STORAGE_KEY] || [];
    list.push({
      text: message,
      timestamp: Date.now()
    });
    chrome.storage.local.set({ [STORAGE_KEY]: list });
  });
}

// Fetch all saved history items
export function getHistory(callback) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    callback(result[STORAGE_KEY] || []);
  });
}

// Clear entire chat history
export function clearHistory(callback) {
  chrome.storage.local.remove([STORAGE_KEY], () => {
    if (callback) callback();
  });
}
