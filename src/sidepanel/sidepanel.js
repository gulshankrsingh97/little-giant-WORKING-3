import { saveSettings, loadSettings, clearAllData, getSetting } from './settings.js';


document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const testBtn = document.getElementById('testBtn');
    const messages = document.getElementById('messages');
    const status = document.getElementById('status-dot');
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
                data: { message: message }
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
        avatar.textContent = cls.includes('user') ? '🧑' : '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = content.replace(/\n/g, '<br>');

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
        typingDiv.className = 'message ai-message';
        typingDiv.id = 'typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = '🤖';

        const dots = document.createElement('div');
        dots.className = 'message-content typing-indicator';

        typingDiv.appendChild(avatar);
        typingDiv.appendChild(dots);
        messages.appendChild(typingDiv);
        messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
    }

    function removeTyping() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }
});

function renderHistoryList(history) {
  historyList.innerHTML = '';
  history.reverse().forEach(entry => {
    const li = document.createElement('li');
    li.textContent = entry.text;
    li.title = new Date(entry.timestamp).toLocaleString();
    li.addEventListener('click', () => {
      messageInput.value = entry.text;
      historyPanel.style.display = 'none';
      messageInput.focus();
    });
    historyList.appendChild(li);
  });
};
