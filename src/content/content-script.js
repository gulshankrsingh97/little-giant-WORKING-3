console.log('🏔️ Little Giant content script loaded on:', window.location.href);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PERFORM_PAGE_ACTION' && message.intent) {
    performAction(message.intent)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: String(error) }));
    return true;
  }
  // ... existing handlers if any
});

async function performAction(intent) {
  try {
    switch (intent.action) {
      case 'click':
        return handleClick(intent.target);
      case 'type':
      case 'search':
        return handleType(intent.target, intent.value);
      case 'scroll':
        return handleScroll(intent.target);
      // Navigation is handled by background; chat is no-op here
      default:
        return { success: true, message: 'No page action needed' };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function handleClick(targetDesc) {
  // Try to find button/link matching text
  let el = null;
  if (targetDesc) {
    // Try for button, input[type=button], or link by text
    el = [...document.querySelectorAll('button,input[type=button],a')]
      .find(e => e.textContent.trim().toLowerCase().includes(targetDesc.toLowerCase())
        || (e.value && e.value.toLowerCase().includes(targetDesc.toLowerCase())));
  }
  if (el) {
    el.click();
    return { success: true, message: 'Clicked element: ' + targetDesc };
  } else {
    return { success: false, error: `Could not find element to click: ${targetDesc}` };
  }
}

function handleType(targetDesc, value) {
  // Try to find input or textarea matching label/placeholder/text
  let el = null;
  if (targetDesc) {
    el = [...document.querySelectorAll('input[type=text],input[type=search],input:not([type]),textarea')]
      .find(e =>
        (e.placeholder && e.placeholder.toLowerCase().includes(targetDesc.toLowerCase())) ||
        (e.labels && [...e.labels].some(l => l.textContent && l.textContent.toLowerCase().includes(targetDesc.toLowerCase())))
      );
  }
  // Fallback: first input
  if (!el) el = document.querySelector('input,textarea');
  if (el) {
    el.focus();
    el.value = value || "";
    el.dispatchEvent(new Event('input', { bubbles: true }));
    // Optionally, trigger Enter for search
    if (targetDesc && targetDesc.toLowerCase().includes('search')) {
      el.form?.dispatchEvent(new Event('submit', { bubbles: true })) || el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
    return { success: true, message: 'Typed: ' + value };
  } else {
    return { success: false, error: 'Could not find input to type' };
  }
}

function handleScroll(targetDesc) {
  if (!targetDesc) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    return { success: true, message: 'Scrolled to bottom' };
  }
  if (targetDesc.toLowerCase().includes('top')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { success: true, message: 'Scrolled to top' };
  } else if (targetDesc.toLowerCase().includes('bottom')) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    return { success: true, message: 'Scrolled to bottom' };
  } else {
    // Attempt to find element and scroll to it
    let el = [...document.querySelectorAll('*')].find(e => e.textContent.trim().toLowerCase().includes(targetDesc.toLowerCase()));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return { success: true, message: 'Scrolled to element' };
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return { success: false, error: 'Could not find target element to scroll, scrolled to bottom instead' };
    }
  }
}