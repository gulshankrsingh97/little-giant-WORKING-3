// Little Giant AI - WORKING Service Worker
console.log('🏔️ Service Worker Started');

// Global state
let aiProvider = null;
let isInitialized = false;

// Register listeners immediately (synchronously)
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.sidePanel.open(); // explicitly open the side panel
});

// SINGLE message listener that handles everything
chrome.runtime.onMessage.addListener(handleMessage);
chrome.alarms.onAlarm.addListener(handleAlarm);

// Lifecycle events
self.addEventListener('install', (event) => {
  console.log('📦 Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Activated');
  event.waitUntil(initialize());
});

// Initialize extension
async function initialize() {
  try {
    // Set default settings
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

    // Initialize AI provider
    await initializeAI();
    isInitialized = true;
    console.log('🎯 Extension initialized');
  } catch (error) {
    console.error('❌ Initialize failed:', error);
  }
}

// Initialize AI provider
async function initializeAI() {
  try {
    const { settings } = await chrome.storage.sync.get(['settings']);
    aiProvider = new LocalAIProvider(settings?.lmStudioURL || 'http://localhost:1234');
    console.log('🤖 AI Provider ready');
  } catch (error) {
    console.error('❌ AI init failed:', error);
  }
}

// Message handler (NOT async) - HANDLES ALL MESSAGES
function handleMessage(message, sender, sendResponse) {
  console.log('📨 Message:', message.type);

  switch (message.type) {
    case 'CLASSIFY_INTENT':
      classifyIntent(message.data.message)
        .then(result => sendResponse({ success: true, intent: result }))
        .catch(error => {
          console.error('Classification error:', error);
          // Return chat intent as fallback
          sendResponse({ 
            success: true, 
            intent: { action: 'chat', url: null, reasoning: 'classification failed' }
          });
        });
      return true;

    case 'OPEN_URL':
      if (message.url) {
        chrome.tabs.create({ url: message.url }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error('Error opening tab:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
        return true;
      }
      break;

    case 'CHAT':
      handleChat(message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open

    case 'TEST_CONNECTION':
      testConnection()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'DEBUG_TEST':
      console.log('🔍 Debug test received');
      sendResponse({ success: true, message: 'Service worker responding!' });
      return false; // Sync response

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}

// AI Intent Classification Function
async function classifyIntent(userMessage) {
  const classificationPrompt = `
Analyze this user message and determine if they want to:
1. Open a website/URL 
2. Have a normal chat conversation

User message: "${userMessage}"

Respond with ONLY a JSON object in this exact format, NO explanations or code block marks or any invalid json.”
{
  "action": "open_website" or "chat",
  "url": "full URL with https://" or null,
  "reasoning": "brief explanation"
}

Examples:
- "open amazon" -> {"action": "open_website", "url": "https://www.amazon.com", "reasoning": "user wants to open Amazon"}
- "go to youtube" -> {"action": "open_website", "url": "https://www.youtube.com", "reasoning": "user wants to open YouTube"}  
- "what is the weather" -> {"action": "chat", "url": null, "reasoning": "user asking for information"}
`;

  try {
    if (!aiProvider) {
      await initializeAI();
    }

    if (!aiProvider) {
      return { action: 'chat', url: null, reasoning: 'AI provider not available' };
    }

    // Use your existing chat method
    const messages = [{ role: 'user', content: classificationPrompt }];
    const response = await aiProvider.chat(messages);

    console.log(response);
    
    // Parse the JSON response from AI
    const regex = /```json\s*([\s\S]*?)\s*```/;
    const match = response.content.trim().match(regex);

    const jsonString = match ? match[1] : null;
    const intent = JSON.parse(jsonString);
    console.log(intent);

    
    return intent;
  } catch (error) {
    console.error('Intent classification failed:', error);
    // Default to chat if classification fails
    return {
      action: 'chat',
      url: null,
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
    console.error('❌ Chat error:', error);
    return {
      success: false,
      error: error.message,
      message: `Error: ${error.message}`
    };
  }
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

    const result = await aiProvider.testConnection();
    return { success: true, message: 'Connected to LM Studio', provider: 'local' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Local AI Provider Class
class LocalAIProvider {
  constructor(baseURL = 'http://localhost:1234') {
    this.baseURL = baseURL;
    this.model = 'deepseek-coder-v2-lite-instruct';
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/v1/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ LM Studio connection successful');
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      throw error;
    }
  }

  async chat(messages) {
    try {
      console.log('🗨️ Sending chat request to LM Studio');

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

      console.log('✅ LM Studio response received');

      return {
        content: data.choices[0].message.content,
        usage: data.usage || { total_tokens: 0 },
        provider: 'local'
      };
    } catch (error) {
      console.error('❌ Chat request failed:', error);
      throw error;
    }
  }
}

// Alarm handler
function handleAlarm(alarm) {
  console.log('⏰ Alarm:', alarm.name);
}

console.log('🏔️ Service Worker Loaded');
