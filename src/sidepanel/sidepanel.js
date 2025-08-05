document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const testBtn = document.getElementById('testBtn');
  const messages = document.getElementById('messages');
  const status = document.getElementById('status-dot');
  document.body.classList.add('dark-mode');
  status.textContent = '⚪';

  sendBtn.addEventListener('click', sendMessage);
  testBtn.addEventListener('click', testConnection);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage('user-message', message);
    messageInput.value = '';
    status.textContent = '🟡';

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
          case 'search':
          case 'scroll': {
            // Perform direct page action
            const actionResponse = await chrome.runtime.sendMessage({
              type: 'PERFORM_ACTION',
              data: intent
            });
            if (actionResponse.success) {
              addMessage('assistant', `Action performed: ${intent.action} (${intent.target || ''})`);
              status.textContent = '🟢';
            } else {
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
        addMessage('assistant', response.message);
        status.textContent = '🟢';
      } else {
        addMessage('error', response?.error || 'Failed to get response');
        status.textContent = '🔴';
      }
    } catch (error) {
      addMessage('error', `Connection error: ${error.message}`);
      status.textContent = '🔴';
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
    messageDiv.innerHTML = content.replace(/\n/g, '<br>');
    messages.appendChild(messageDiv);
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }
});