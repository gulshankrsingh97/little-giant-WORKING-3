import { summarizePage } from './summarizer.js';
import { saveHistory, getHistory, clearHistory } from './history.js';

/* =========================
   Settings helpers
   ========================= */
async function getSettings() {
  const { settings } = await chrome.storage.sync.get('settings');
  return settings || { lmStudioURL: 'http://localhost:1234', model: 'openai/gpt-oss-20b' };
}
async function setSettings(newValues) {
  const current = await getSettings();
  await chrome.storage.sync.set({ settings: { ...current, ...newValues } });
}

// in service worker (once), re-init AI when sync settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
    initializeAI(); // re-read lmStudioURL/model and recreate provider
  }
});


/* =========================
   Service Worker bootstrap
   ========================= */
console.log('🏔️ Service Worker Started');
let aiProvider = null;
let isInitialized = false;

chrome.runtime.onInstalled.addListener(async () => {
  await testConnection();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.action.onClicked.addListener(async () => {
  await testConnection();
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

/* =========================
   Initialization
   ========================= */
async function initialize() {
  try {
    const stored = await chrome.storage.sync.get(['settings']);
    if (!stored.settings) {
      await chrome.storage.sync.set({
        settings: { lmStudioURL: 'http://localhost:1234', model: 'openai/gpt-oss-20b' }
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
    const { lmStudioURL, model } = await getSettings();
    aiProvider = new LocalAIProvider(lmStudioURL, model);
    console.log('🤖 AI Provider ready at', lmStudioURL, 'model:', model);
  } catch (error) {
    console.error('❌ AI init failed:', error);
  }
}

/* =========================
   Message Router
   ========================= */
function handleMessage(message, sender, sendResponse) {
  console.log('📨 Message:', message.type);

  switch (message.type) {
    case 'CLASSIFY_INTENT':
      classifyIntent(message.data.message)
        .then(result => sendResponse({ success: true, intent: result }))
        .catch(error => {
          console.error('Classification error:', error);
          sendResponse({ success: true, intent: { action: 'chat', url: null, target: null, value: null, reasoning: 'classification failed' } });
        });
      return true;

      case 'PERFORM_ACTION':
          handlePerformAction(message.data)
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

      // Add new message types to your handleMessage function
      case 'ATTACH_FILES':
          handleFileAttachment(message.data)
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

      case 'PROCESS_FILES':
          processAttachedFiles(message.data)
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

      case 'REMOVE_FILE':
          handleRemoveFile(message.data)
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

      case 'CLEAR_FILES':
          handleClearFiles()
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ success: false, error: error.message }));
          return true;

      case 'GET_ATTACHED_FILES':
          handleGetAttachedFiles()
              .then(result => sendResponse(result))
              .catch(error => sendResponse({ success: false, error: error.message }));
          return true;


      case 'OPEN_URL':
      if (message.url) {
        chrome.tabs.update({ url: message.url }, (tab) => {
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

    case 'SAVE_HISTORY':
      if (message.data?.text) {
        saveHistory(message.data.text);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No text provided' });
      }
      return true;

    case 'GET_HISTORY':
      getHistory((list) => sendResponse({ success: true, data: list }));
      return true;

    case 'CLEAR_HISTORY':
      clearHistory(() => sendResponse({ success: true }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}

/* =========================
   JSON Extractor (robust)
   ========================= */
function extractFirstJsonObject(text) {
  if (!text) throw new Error('Empty response');
  let s = String(text).trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/, '')
    .trim();
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object start');
  let depth = 0, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('Unbalanced JSON');
  const block = s.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(block);
}

/* =========================
   Intent Classifier
   ========================= */
async function classifyIntent(userMessage) {
const classificationPrompt = `
You are an AI assistant for Oracle DB networking + general web actions. Output a SINGLE JSON object only (no prose/markdown).

OUTPUT JSON (exact keys):
{
  "action": "navigate"|"click"|"type"|"search"|"scroll"|"chat"|"#websearch"|"#images"|"#videos",
  "url": string|null,
  "target": string|null,
  "value": string|null,
  "reasoning": string
}

HARD RULES
- Return ONLY raw JSON. First char "{" last char "}". No code fences, no extra text.
- All five keys must exist. Use null when not applicable. 
- Give HTML friendly response message in case of chat as will be used html enhancer to render.

SEMANTIC RULES
- Oracle networking/help (listeners, TNS/tnsnames.ora/sqlnet.ora, ORA-*, RAC/SCAN, Data Guard, JDBC/ODP, TLS/TCPS, firewall/NAT, tnsping/lsnrctl/sqlplus) → "chat".
- Explicit search requests (search/google/find/images/videos/AI overview) or general non-Oracle info → "#websearch"/"#images"/"#videos" (build proper URLs).
  scroll     -> should give action scroll and type in target and direction in value.
  click      -> should give action click and target. good target examples{ "login","submit","search","next","continue","cancel","apply filters, "play"}.
  #websearch → https://www.google.com/search?q=URL_ENCODED_QUERY
  #images   → https://www.google.com/search?tbm=isch&q=URL_ENCODED_QUERY
  #videos   → https://www.youtube.com/results?search_query=URL_ENCODED_QUERY
  If AI overview explicitly requested → append &udm=2
- Navigation intent (open/go to/site/domain) → "navigate" with https URL.
  Known sites: youtube→https://youtube.com, twitter→https://twitter.com, facebook→https://facebook.com, instagram→https://instagram.com,
               amazon→https://amazon.in, flipkart→https://flipkart.com, myntra→https://myntra.com, ajio→https://ajio.com,
               aajtak→https://aajtak.in, ndtv→https://ndtv.com, times of india|toi→https://timesofindia.indiatimes.com,
               hindustantimes→https://hindustantimes.com, github→https://github.com, stackoverflow→https://stackoverflow.com, google→https://google.com
  Bare domain like youtube.com → prepend https.
  Unknown single-word site → https://<name>.com
- UI verbs: "click …" → "click" (put element in target); "type X in Y" → "type" (target, value); "scroll …" → "scroll".
- Version/OS-specific or possibly outdated topics → if user asks for latest/docs, prefer "#websearch"; else "chat" and mention docs in reasoning.
- Context reuse: if message references prior steps/configs, keep "chat" and note follow-up in reasoning.

FORCE THESE TO JSON (to stop free-text answers)
- Greetings/identity: "hi", "hello", "hey", "good morning", "good evening", "who are you" → action "chat", reasoning "Greeting detected; respond in chat."
- Capability queries: "what can you do", "your capabilities", "how can you help" → action "chat", reasoning "User asked capabilities overview."

STRICTNESS
Start with "{" end with "}". No extra characters. No markdown. No explanations outside JSON.

User message: "\${userMessage}"
`;


  try {
    if (!aiProvider) await initializeAI();
    if (!aiProvider) {
      return { action: 'chat', url: null, target: null, value: null, reasoning: 'AI provider not available' };
    }

    // IMPORTANT: send rules and user text clearly
    const messages = [
      { role: 'user', content: classificationPrompt },
      { role: 'user', content: `User message: "${userMessage}"` }
    ];

    const response = await aiProvider.chat(messages);
    const intent = extractFirstJsonObject(response.content); // uses your robust extractor
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
 


/* =========================
   Chat Handler
   ========================= */
async function handleChat(data) {
  try {
    if (!aiProvider) await initializeAI();
    if (!aiProvider) {
      return { success: true, message: 'AI provider not available. Make sure LM Studio is running', provider: 'none' };
    }

    // Load existing conversation
    let historyList = await new Promise(resolve => getHistory(resolve));
    
    // Check for attached files
    const { attachedFiles } = await chrome.storage.local.get('attachedFiles');
    
    // Build context with file information
    let contextMessage = '';
    if (attachedFiles && attachedFiles.length > 0) {
      contextMessage = buildFileContext(attachedFiles);
      
      // Add file context as system message if files are present
      if (contextMessage) {
        const fileContextMsg = {
          role: 'system',
          content: `Files attached to this conversation:\n${contextMessage}\n\nUse this file content to answer questions. Reference specific files when relevant.`
        };
        
        // Insert file context before the latest user message
        historyList.push(fileContextMsg);
      }
    }

    // Add the new user message
    const userMsg = { role: 'user', content: data.message || 'Hello' };
    historyList.push(userMsg);

    // Send to AI with file context
    const response = await aiProvider.chat(historyList);

    // Add assistant's reply
    const assistantMsg = { role: 'assistant', content: response.content };
    historyList.push(assistantMsg);

    // Save updated history (excluding file context system message)
    saveHistory(userMsg);
    saveHistory(assistantMsg);

    return { 
      success: true, 
      message: response.content, 
      provider: response.provider, 
      usage: response.usage,
      filesAttached: attachedFiles ? attachedFiles.length : 0
    };

  } catch (error) {
    return { success: false, error: error.message, message: `Error: ${error.message}` };
  }
}

function buildFileContext(attachedFiles) {
  let context = '';
  
  for (const file of attachedFiles) {
    context += `\n--- File: ${file.name} (${file.type}) ---\n`;
    
    if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'application/json') {
      // Include full content for text files
      context += file.content + '\n';
    } else if (file.type === 'text/csv') {
      // Include CSV content with some structure
      context += `CSV Content:\n${file.content}\n`;
    } else {
      // For binary files, just include metadata
      context += `[Binary file - ${Math.round(file.size/1024)}KB]\n`;
    }
    
    context += '--- End of file ---\n';
  }
  
  return context;
}





/* =========================
   Page Action Performer
   ========================= */
async function handlePerformAction(intent) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return resolve({ success: false, error: 'No active tab' });
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { type: 'PERFORM_PAGE_ACTION', intent }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { success: true });
        }
      });
    });
  });
}

/* =========================
   Connection Test
   ========================= */
async function testConnection() {
  const u = chrome.runtime.getURL('homepage.html');
  chrome.tabs.update({ url: u }, () => {
    if (chrome.runtime.lastError) console.log(chrome.runtime.lastError.message);
  });
  try {
    if (!aiProvider) await initializeAI();
    if (!aiProvider) return { success: false, error: 'AI provider not initialized' };
    await aiProvider.testConnection();
    return { success: true, message: 'Connected to LM Studio', provider: 'local' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/* =========================
   Local AI Provider
   ========================= */
class LocalAIProvider {
  constructor(baseURL = 'http://localhost:1234', model = 'openai/gpt-oss-20b') {
    this.baseURL = baseURL;
    this.model = model;
  }
  async testConnection() {
    const response = await fetch(`${this.baseURL}/v1/models`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return true;
  }
  async chat(messages) {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
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
    if (!data.choices?.[0]?.message) throw new Error('Invalid response from LM Studio');
    return { content: data.choices[0].message.content, usage: data.usage || { total_tokens: 0 }, provider: 'local' };
  }
}

/* =========================
   Alarms / Misc
   ========================= */
function handleAlarm(alarm) {
  console.log('⏰ Alarm:', alarm.name);
}

console.log('🏔️ Service Worker Loaded');


// Add these functions to your service worker

/* =========================
   File Processing Functions
   ========================= */

async function handleFileAttachment(data) {
  try {
    const { files, fileContents } = data;
    
    // Store file metadata
    const fileMetadata = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      fileMetadata.push({
        name: file.name,
        size: file.size,
        type: file.type,
        content: fileContents[i], // Base64 or text content
        lastModified: file.lastModified
      });
    }
    
    // Save to chrome storage for persistence
    await chrome.storage.local.set({
      attachedFiles: fileMetadata,
      filesAttachedAt: Date.now()
    });
    
    return { 
      success: true, 
      message: `${files.length} file(s) attached successfully`,
      files: fileMetadata.map(f => ({ name: f.name, size: f.size, type: f.type }))
    };
    
  } catch (error) {
    console.error('File attachment error:', error);
    return { success: false, error: error.message };
  }
}

async function processAttachedFiles(data) {
  try {
    // Get attached files from storage
    const { attachedFiles } = await chrome.storage.local.get('attachedFiles');
    
    if (!attachedFiles || attachedFiles.length === 0) {
      return { success: false, error: 'No files attached' };
    }
    
    // Process files based on type
    const processedFiles = [];
    for (const file of attachedFiles) {
      const processed = await processFileByType(file);
      processedFiles.push(processed);
    }
    
    return { 
      success: true, 
      processedFiles,
      totalFiles: processedFiles.length
    };
    
  } catch (error) {
    console.error('File processing error:', error);
    return { success: false, error: error.message };
  }
}

async function processFileByType(file) {
  const { name, type, content, size } = file;
  
  try {
    let processedContent = '';
    
    switch (type) {
      case 'text/plain':
      case 'text/markdown':
      case 'application/json':
        // Direct text content
        processedContent = content;
        break;
        
      case 'application/pdf':
        // For PDFs, you might want to extract text
        // This would require additional processing
        processedContent = `[PDF File: ${name}, ${Math.round(size/1024)}KB]`;
        break;
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // For DOCX files
        processedContent = `[DOCX File: ${name}, ${Math.round(size/1024)}KB]`;
        break;
        
      case 'text/csv':
        // CSV content can be processed as text
        processedContent = content;
        break;
        
      default:
        processedContent = `[File: ${name}, Type: ${type}, ${Math.round(size/1024)}KB]`;
    }
    
    return {
      name,
      type,
      size,
      content: processedContent,
      processed: true
    };
    
  } catch (error) {
    return {
      name,
      type,
      size,
      content: `[Error processing ${name}: ${error.message}]`,
      processed: false,
      error: error.message
    };
  }
}


// Implementation functions
async function handleRemoveFile(data) {
  try {
    const { index } = data;
    const { attachedFiles } = await chrome.storage.local.get('attachedFiles');
    
    if (attachedFiles && attachedFiles[index]) {
      attachedFiles.splice(index, 1);
      await chrome.storage.local.set({ attachedFiles });
      
      return {
        success: true,
        remainingFiles: attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
      };
    }
    
    return { success: false, error: 'File not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleClearFiles() {
  try {
    await chrome.storage.local.remove(['attachedFiles', 'filesAttachedAt']);
    return { success: true, message: 'All files cleared' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetAttachedFiles() {
  try {
    const { attachedFiles } = await chrome.storage.local.get('attachedFiles');
    return {
      success: true,
      files: attachedFiles ? attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })) : []
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}