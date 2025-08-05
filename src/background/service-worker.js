import { summarizePage } from './summarizer.js';

// Little Giant AI - WORKING Service Worker
console.log('🏔️ Service Worker Started');

// Global state
let aiProvider = null;
let isInitialized = false;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.sidePanel.open();
});

chrome.runtime.onMessage.addListener(handleMessage);
chrome.alarms.onAlarm.addListener(handleAlarm);

self.addEventListener('install', (event) => {
  console.log('📦 Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Activated');
  event.waitUntil(initialize());
});

async function initialize() {
  try {
    const stored = await chrome.storage.sync.get(['settings']);
    if (!stored.settings) {
      await chrome.storage.sync.set({
        settings: {
          lmStudioURL: 'http://localhost:1234',
          model: 'deepseek-coder-v2-lite-instruct'
        }
      });
      console.log('✅ Default settings saved');
    }
    await initializeAI();
    isInitialized = true;
    console.log('🎯 Extension initialized');
  } catch (error) {
    console.error('❌ Initialize failed:', error);
  }
}

async function initializeAI() {
  try {
    const { settings } = await chrome.storage.sync.get(['settings']);
    aiProvider = new LocalAIProvider(settings?.lmStudioURL || 'http://localhost:1234');
    console.log('🤖 AI Provider ready');
  } catch (error) {
    console.error('❌ AI init failed:', error);
  }
}

// Updated: General-purpose handler for multi-step & multi-action AI
function handleMessage(message, sender, sendResponse) {
  console.log('📨 Message:', message.type);

  switch (message.type) {
    case 'CLASSIFY_INTENT':
      classifyIntent(message.data.message)
        .then(result => sendResponse({ success: true, intent: result }))
        .catch(error => {
          console.error('Classification error:', error);
          sendResponse({
            success: true,
            intent: { action: 'chat', url: null, target: null, value: null, reasoning: 'classification failed' }
          });
        });
      return true;

    case 'PERFORM_ACTION':
      handlePerformAction(message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'OPEN_URL':
      if (message.url) {
        chrome.tabs.create({ url: message.url }, (tab) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, tabId: tab.id });
          }
        });
        return true;
      }
      break;

    case 'CHAT':
      handleChat(message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'TEST_CONNECTION':
      testConnection()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'DEBUG_TEST':
      console.log('🔍 Debug test received');
      sendResponse({ success: true, message: 'Service worker responding!' });
      return false;

    case 'SUMMARIZE_PAGE':
     summarizePage(message.data, aiProvider)
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ success: false, error: error.message }));
     return true;


    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}

// Enhanced prompt and parsing for multi-action support
async function classifyIntent(userMessage) {
  const classificationPrompt = `
Analyze this user message and classify the action to be performed on a web page or in a conversation.

Respond ONLY with a valid JSON object (no code block marks or explanations).

Available actions:
- "navigate": Open a web page or URL
- "click": Click a button, link, or page element
- "type": Type into a text box or form
- "search": Enter a search into a search field
- "scroll": Scroll the page or to an element
- "chat": Conversation only, no web action

RESPONSE FORMAT:
{
  "action": "click" | "type" | "search" | "scroll" | "navigate" | "chat",
  "url": "full URL with https://" or null,
  "target": "Descriptive text or selector of element, if relevant, else null",
  "value": "Text to type or search, else null",
  "reasoning": "brief explanation"
}

Examples:
- "open amazon": {"action": "navigate", "url": "https://www.amazon.com", "target": null, "value": null, "reasoning": "user wants to open Amazon"}
- "search for cats on youtube": {"action": "search", "url": null, "target": "YouTube search box", "value": "cats", "reasoning": "user wants to search for cats on YouTube"}
- "click login button": {"action": "click", "url": null, "target": "button labeled login", "value": null, "reasoning": "user wants to click login"}
- "type my email": {"action": "type", "url": null, "target": "email input box", "value": "my@email.com", "reasoning": "user wants to type their email"}
- "scroll to bottom": {"action": "scroll", "url": null, "target": "bottom of page", "value": null, "reasoning": "user wants to scroll down"}
- "what is the weather?": {"action": "chat", "url": null, "target": null, "value": null, "reasoning": "conversation"}

User message: "${userMessage}"
`;

  try {
    if (!aiProvider) {
      await initializeAI();
    }
    if (!aiProvider) {
      return { action: 'chat', url: null, target: null, value: null, reasoning: 'AI provider not available' };
    }
    const messages = [{ role: 'user', content: classificationPrompt }];
    const response = await aiProvider.chat(messages);
    // Extract JSON (strip code block marks, if any)
    let jsonString = response.content.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```/, '').replace(/```$/, '').trim();
    }
    const intent = JSON.parse(jsonString);
    return intent;
  } catch (error) {
    console.error('Intent classification failed:', error);
    return {
      action: 'chat',
      url: null,
      target: null,
      value: null,
      reasoning: 'classification failed, defaulting to chat'
    };
  }
}

// Handle chat requests
async function handleChat(data) {
  try {
    if (!aiProvider) {
      await initializeAI();
    }
    if (!aiProvider) {
      return {
        success: true,
        message: "AI provider not available. Make sure LM Studio is running on http://localhost:1234",
        provider: 'none'
      };
    }
    const messages = data.messages || [{ role: 'user', content: data.message || 'Hello' }];
    const response = await aiProvider.chat(messages);
    return {
      success: true,
      message: response.content,
      provider: response.provider,
      usage: response.usage
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `Error: ${error.message}`
    };
  }
}

// Handle generic action on page: forward to content-script via tab message
async function handlePerformAction(intent) {
  return new Promise((resolve, reject) => {
    // Find active tab
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || tabs.length === 0) {
        resolve({ success: false, error: 'No active tab' });
        return;
      }
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { type: 'PERFORM_PAGE_ACTION', intent: intent }, resp => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { success: true });
        }
      });
    });
  });
}

// Test connection
async function testConnection() {
  try {
    if (!aiProvider) {
      await initializeAI();
    }
    if (!aiProvider) {
      return { success: false, error: 'AI provider not initialized' };
    }
    await aiProvider.testConnection();
    return { success: true, message: 'Connected to LM Studio', provider: 'local' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// LocalAIProvider as before
class LocalAIProvider {
  constructor(baseURL = 'http://localhost:1234') {
    this.baseURL = baseURL;
    this.model = 'deepseek-coder-v2-lite-instruct';
  }
  async testConnection() {
    const response = await fetch(`${this.baseURL}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return true;
  }
  async chat(messages) {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: -1,
        stream: false
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio error ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from LM Studio');
    }
    return {
      content: data.choices[0].message.content,
      usage: data.usage || { total_tokens: 0 },
      provider: 'local'
    };
  }
}

function handleAlarm(alarm) {
  console.log('⏰ Alarm:', alarm.name);
}

console.log('🏔️ Service Worker Loaded');