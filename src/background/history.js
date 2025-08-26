// history.js — minimal, safe patch
const CHAT_HISTORY_KEY = 'chatHistory';

export function saveHistory(entry, cb = () => {}) {
  chrome.storage.local.get([CHAT_HISTORY_KEY], (res) => {
    const arr = Array.isArray(res[CHAT_HISTORY_KEY]) ? res[CHAT_HISTORY_KEY] : [];
    // normalize: support strings or {role, content}
    const item = (typeof entry === 'string')
      ? { role: 'user', content: entry }
      : entry && entry.role && entry.content
        ? entry
        : null;
    if (item) arr.push(item);
    chrome.storage.local.set({ [CHAT_HISTORY_KEY]: arr }, cb);
  });
}

export function getHistory(cb) {
  chrome.storage.local.get([CHAT_HISTORY_KEY], (res) => {
    const arr = Array.isArray(res[CHAT_HISTORY_KEY]) ? res[CHAT_HISTORY_KEY] : [];
    cb(arr.filter(m => m && m.role && typeof m.content === 'string'));
  });
}

export function clearHistory(cb = () => {}) {
  chrome.storage.local.remove(CHAT_HISTORY_KEY, cb);
}
