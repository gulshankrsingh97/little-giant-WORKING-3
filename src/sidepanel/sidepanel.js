document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const testBtn = document.getElementById('testBtn');
  const messages = document.getElementById('messages');
  const status = document.getElementById('status-dot');
  document.body.classList.add('dark-mode');

    // Reset to default dot style initially
  status.textContent = '⚪';


  // Test debug connection first
//   testDebugConnection();

  sendBtn.addEventListener('click', sendMessage);
  testBtn.addEventListener('click', testConnection);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

async function testDebugConnection() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'DEBUG_TEST'
    });

    if (response && response.success) {
      console.log('✅ Service worker responding:', response.message);
      status.textContent = '🟢';
    } else {
      console.error('❌ Service worker not responding');
      status.textContent = '🔴';
    }
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    status.textContent = '🔴';
  }
}



async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  addMessage('user', message);
  messageInput.value = '';

  try {
    // Step 1: Ask AI to classify the intent first
    const classificationResponse = await chrome.runtime.sendMessage({
      type: 'CLASSIFY_INTENT',
      data: { message: message }
    });

    if (classificationResponse && classificationResponse.success) {
      const intent = classificationResponse.intent;

      // Step 2: Handle based on AI's classification
      if (intent.action === 'open_website' && intent.url) {
        // AI determined this is a website opening request
        status.textContent = '🟡';
        chrome.runtime.sendMessage({
          type: 'OPEN_URL',
          url: intent.url
        });
        addMessage('assistant', `Opening ${intent.url}...`);
          status.textContent = '🟢';
        return;
      }
    }

    // If not a website request, do normal chat
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
        status.textContent = '🟡';
      } else {
        status.textContent = '🟢';  
      }
    } catch (error) {
        status.textContent = '🔴';
    }

    setTimeout(() => {
      testBtn.textContent = originalText;
        status.textContent = '🔴';
    }, 3000);
  }

  function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.textContent = content;
    messageDiv.innerHTML = content.replace(/\n/g, '<br>');
    messages.appendChild(messageDiv);

    // Auto-scroll
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
    // messages.appendChild(messageDiv);
    // messages.scrollTop = messages.scrollHeight;
  }
});