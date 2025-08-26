import { saveSettings, loadSettings, clearAllData, getSetting } from './settings.js';
import { setCurrentModel, getCurrentModel } from './settings.js'; 

document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const testBtn = document.getElementById('testBtn');
    const messages = document.getElementById('messages');
    const status = document.getElementById('status-dot');

    const modelSelect = document.getElementById('modelSelect');

    // Load previously chosen model on startup
    getCurrentModel(selected => {
        modelSelect.value = selected;
    });

    // Persist changes when user selects a new model
    modelSelect.addEventListener('change', e => {
        setCurrentModel(e.target.value);
    });


    status.textContent = '⚪';

    sendBtn.addEventListener('click', sendMessage);
    const backToChatBtn = document.getElementById('backToChatBtn');
    backToChatBtn.addEventListener('click', () => {
     historyPanel.style.display = 'none';
     });


    const summarizeBtn = document.getElementById('summarizeBtn');
    summarizeBtn.addEventListener('click', summarizePage);

    const quickButtons = document.querySelectorAll('.quick-btn');
    quickButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            if (!messageInput.value.includes(tag)) {
                messageInput.value = `${tag} ` + messageInput.value;
                messageInput.focus();
            }
        });
    });

    const historyBtn = document.getElementById('historyBtn');
    const historyPanel = document.getElementById('history-panel');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const historyList = document.getElementById('historyList');

    // Toggle history panel on button click
    historyBtn.addEventListener('click', () => {
        const isVisible = historyPanel.style.display === 'block';
        if (isVisible) {
            historyPanel.style.display = 'none';
        } else {
            chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (res) => {
                if (res.success) {
                    renderHistoryList(res.data);
                    historyPanel.style.display = 'block';
                }
            });
        }
    });

    // Clear history on trash icon click
    clearHistoryBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
            renderHistoryList([]);
        });
    });


    function renderHistoryList(history) {
  // historyList, messageInput, historyPanel are in scope here
  historyList.innerHTML = '';

  // Don't mutate original array; also handle both {text,timestamp} and {role,content}
  const items = Array.isArray(history) ? [...history].reverse() : [];
  items.forEach(entry => {
    const text = entry.text ?? entry.content ?? '';
    const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';

    const li = document.createElement('li');
    li.textContent = text;
    if (ts) li.title = ts;

    li.addEventListener('click', () => {
      messageInput.value = text;
      historyPanel.style.display = 'none';
      messageInput.focus();
    });

    historyList.appendChild(li);
  });
}
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');

    // Show settings panel
    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'block';
    });

    // Hide settings panel
    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
    });

    settingsBtn.addEventListener('click', () => {
        historyPanel.style.display = 'none'; // Hide history
        settingsPanel.style.display = 'block'; // Show settings
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('Key pressed:', e.key, 'Shift?', e.shiftKey); // DEBUG line
            e.preventDefault();     // Prevent newline
            sendMessage();          // Trigger send
        }
    });


    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        addMessage('user-message', message);
        chrome.runtime.sendMessage({ type: 'SAVE_HISTORY', data: { text: message } });
        messageInput.value = '';
        status.textContent = '🟡';
        showTyping();

        const currentModel = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_MODEL' }, res => resolve(res?.model));
       });

        try {
            // Step 1: Classify user intent (action)
            const classificationResponse = await chrome.runtime.sendMessage({
                type: 'CLASSIFY_INTENT',
                data: { message: message }
            });

            if (classificationResponse && classificationResponse.success) {
                const intent = classificationResponse.intent;

                // Handle by action type
                switch (intent.action) {
                    case 'navigate':
                        // Navigate, then optionally perform more actions if value/target are set (defer for now)
                        chrome.runtime.sendMessage({
                            type: 'OPEN_URL',
                            url: intent.url
                        }, async (response) => {
                            removeTyping();
                            addMessage('assistant', `Opening ${intent.url}...`);
                            if (response && response.tabId && (intent.value || intent.target)) {
                                // Ideally, wait for navigation and then send perform-action message
                                // For now, the user should issue a follow-up command when ready
                                // Could enhance with tabUpdate listener for ready state
                            }
                            status.textContent = '🟢';
                        });
                        return;
                    case 'click':
                    case 'type':
                    case '#websearch':
                        chrome.runtime.sendMessage({
                            type: 'OPEN_URL',
                            url: intent.url
                        }, async (response) => {
                            removeTyping();
                            addMessage('assistant', `Opening ${intent.url}...`);
                            if (response && response.tabId && (intent.value || intent.target)) {
                                // Ideally, wait for navigation and then send perform-action message
                                // For now, the user should issue a follow-up command when ready
                                // Could enhance with tabUpdate listener for ready state
                            }
                            status.textContent = '🟢';
                        });
                        return;
                    case '#images':
                        chrome.runtime.sendMessage({
                            type: 'OPEN_URL',
                            url: intent.url
                        }, async (response) => {
                            removeTyping();
                            addMessage('assistant', `Opening ${intent.url}...`);
                            if (response && response.tabId && (intent.value || intent.target)) {
                                // Ideally, wait for navigation and then send perform-action message
                                // For now, the user should issue a follow-up command when ready
                                // Could enhance with tabUpdate listener for ready state
                            }
                            status.textContent = '🟢';
                        });
                        return;
                    case '#videos':
                        chrome.runtime.sendMessage({
                            type: 'OPEN_URL',
                            url: intent.url
                        }, async (response) => {
                            removeTyping();
                            addMessage('assistant', `Opening ${intent.url}...`);
                            if (response && response.tabId && (intent.value || intent.target)) {
                                // Ideally, wait for navigation and then send perform-action message
                                // For now, the user should issue a follow-up command when ready
                                // Could enhance with tabUpdate listener for ready state
                            }
                            status.textContent = '🟢';
                        });
                        return;
                    case 'scroll': {
                        // Perform direct page action
                        const actionResponse = await chrome.runtime.sendMessage({
                            type: 'PERFORM_ACTION',
                            data: intent
                        });
                        if (actionResponse.success) {
                            removeTyping();
                            addMessage('assistant', `Action performed: ${intent.action} (${intent.target || ''})`);
                            status.textContent = '🟢';
                        } else {
                            removeTyping();
                            addMessage('assistant', `Action failed: ${actionResponse.error || 'Unknown error'}`);
                            status.textContent = '🔴';
                        }
                        return;
                    }
                    case 'chat':
                    default:
                        // Normal chat fallback
                        break;
                }
            }

            // Chat as fallback or for action 'chat'
            const response = await chrome.runtime.sendMessage({
                type: 'CHAT',
                 data: { message, model: currentModel }
            });

            if (response && response.success) {
                removeTyping();
                addMessage('assistant', response.message);
                status.textContent = '🟢';
            } else {
                removeTyping();
                addMessage('error', response?.error || 'Failed to get response');
                status.textContent = '🔴';
            }
        } catch (error) {
            removeTyping();
            addMessage('error', `Connection error: ${error.message}`);
            status.textContent = '🔴';
        }
    }

    async function summarizePage() {
        addMessage('user', 'Summarize this page');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const pageInfo = await chrome.tabs.sendMessage(tab.id, {
                type: 'ANALYZE_PAGE'
            });

            const response = await chrome.runtime.sendMessage({
                type: 'SUMMARIZE_PAGE',
                data: pageInfo
            });

            if (response && response.success) {
                removeTyping();
                addMessage('assistant', response.message);
            } else {
                removeTyping();
                addMessage('error', response?.error || 'Failed to summarize page');
            }
        } catch (err) {
            removeTyping();
            addMessage('error', 'Summarization error: ' + err.message);
        }
    }
    async function testConnection() {
        const originalText = testBtn.textContent;
        testBtn.textContent = '🟡';

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'TEST_CONNECTION'
            });

            if (response && response.success) {
                status.textContent = '🟢';
            } else {
                status.textContent = '🔴';
            }
        } catch (error) {
            status.textContent = '🔴';
        }
        setTimeout(() => {
            testBtn.textContent = originalText;
            status.textContent = '⚪';
        }, 3000);
    }
function addMessage(cls, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${cls}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
// replace avatar assignment with SVGs
avatar.innerHTML = cls.includes('user')
  ? `<svg class="icon"><use href="#i-user"></use></svg>`
  : `<svg class="icon"><use href="#i-bot"></use></svg>`;


  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // ✨ pretty rendering for AI replies
  const rendered = cls.includes('user') ? renderUser(content) : renderAI(content);
  contentDiv.innerHTML = rendered;

  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  contentDiv.appendChild(timestamp);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  messages.appendChild(messageDiv);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
}


function showTyping() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message assistant';
  typingDiv.id = 'typing-indicator';

  // Custom AI avatar (use #i-bot-custom). For an image: avatar.innerHTML = `<img src="icons/bot.svg" class="icon" alt="">`
  const avatar = document.createElement('div');
  avatar.className = 'avatar';

  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'bubble typing typing-shimmer';
  bubble.innerHTML = `
    <div class="ai-pulse" aria-hidden="true"></div>
    <div class="thinking" aria-live="polite" aria-label="Assistant is thinking">
      <span>Thinking</span><span class="ellipsis"></span>
    </div>
  `;

  contentWrap.appendChild(bubble);
  typingDiv.appendChild(avatar);
  typingDiv.appendChild(contentWrap);

  messages.appendChild(typingDiv);
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
}


    function removeTyping() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }
});

// --- Minimal markdown/HTML formatter for AI replies ---
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function autolink(s) {
  // linkify http(s) URLs
  return s.replace(/((https?:\/\/)[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function blocksFromText(text) {
  // 1) fenced code blocks ``` ```
  let out = text
    .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escapeHtml(code.trim())}</code></pre>`);

  // 2) headings # ## ###
  out = out
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // 3) bullet lists
  out = out.replace(/^(?:-|\*)\s+(.+)$/gm, '<li>$1</li>');
  out = out.replace(/(?:<li>[\s\S]*?<\/li>)(?!\s*<\/ul>)/g, match => `<ul>${match}</ul>`); // wrap lone lis

  // 4) inline code `code`
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);

  // 5) paragraphs (convert remaining double newlines to <p>)
  out = out
    .split(/\n{2,}/).map(chunk => {
      // don't wrap block tags
      if (/^\s*<(h[1-3]|pre|ul|ol|table|blockquote)/i.test(chunk)) return chunk;
      return `<p>${chunk.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

  // 6) autolink plain URLs
  out = autolink(out);

  return out;
}

/**
 * Renders any AI response nicely:
 * - if the content already contains HTML tags, we trust it and just wrap in .ai-card
 * - otherwise, we run the markdown-lite formatter above
 */


// same blocksFromText as you already have
function renderAI(content) {
  if (typeof content !== 'string') content = String(content ?? '');
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  const body = looksHtml ? content : blocksFromText(content.trim());
  // return only formatted inner HTML (no wrapper)
  return `<div class="ai-card">${body}</div>`;
}

function renderUser(content) {
  if (typeof content !== 'string') content = String(content ?? '');
  return `<div>${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
}

// Add to your side panel JavaScript

class FileHandler {
  constructor() {
    this.attachedFiles = [];
    this.initializeFileHandlers();
  }

  initializeFileHandlers() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // Click to select files
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Drag and drop handlers[59][65][68]
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });
  }

  async handleFiles(fileList) {
    const files = Array.from(fileList);
    const fileContents = [];
    const fileMetadata = [];

    for (const file of files) {
      // Validate file size (max 30MB as per LM Studio limits)[42]
      if (file.size > 30 * 1024 * 1024) {
        console.warn(`File ${file.name} is too large (max 30MB)`);
        continue;
      }

      // Read file content[22][25][28]
      const content = await this.readFileContent(file);
      
      fileContents.push(content);
      fileMetadata.push({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
    }

    // Send to service worker
    const response = await chrome.runtime.sendMessage({
      type: 'ATTACH_FILES',
      data: {
        files: fileMetadata,
        fileContents: fileContents
      }
    });

    if (response.success) {
      this.updateFilePreview(response.files);
      console.log('Files attached successfully');
    } else {
      console.error('File attachment failed:', response.error);
    }
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (file.type.startsWith('text/') || 
            file.type === 'application/json' ||
            file.name.endsWith('.md')) {
          resolve(e.target.result);
        } else {
          // For binary files, use base64
          resolve(e.target.result);
        }
      };
      
      reader.onerror = () => reject(reader.error);
      
      // Read as appropriate type[58][64][67]
      if (file.type.startsWith('text/') || 
          file.type === 'application/json' ||
          file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }

  updateFilePreview(files) {
    const container = document.getElementById('file-preview-container');
    container.innerHTML = '';

    files.forEach((file, index) => {
      const fileElement = document.createElement('div');
      fileElement.className = 'file-preview';
      fileElement.innerHTML = `
        <span class="file-name">${file.name}</span>
        <span class="file-size">(${Math.round(file.size/1024)}KB)</span>
        <span class="remove-btn" data-index="${index}">✕</span>
      `;

      // Remove file handler
      fileElement.querySelector('.remove-btn').addEventListener('click', () => {
        this.removeFile(index);
      });

      container.appendChild(fileElement);
    });
  }

  async removeFile(index) {
    // Implementation to remove specific file
    const response = await chrome.runtime.sendMessage({
      type: 'REMOVE_FILE',
      data: { index }
    });

    if (response.success) {
      this.updateFilePreview(response.remainingFiles);
    }
  }

  async clearAllFiles() {
    await chrome.runtime.sendMessage({
      type: 'CLEAR_FILES'
    });
    
    document.getElementById('file-preview-container').innerHTML = '';
  }
}

// Initialize file handler
const fileHandler = new FileHandler();
