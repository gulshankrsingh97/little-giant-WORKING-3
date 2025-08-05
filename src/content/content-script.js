// Little Giant AI - Content Script (Class Based)
console.log('🏔️ Little Giant content script loaded on:', window.location.href);

class LittleGiantContentActions {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Page action dispatcher
      if (message.type === 'PERFORM_PAGE_ACTION' && message.intent) {
        this.performAction(message.intent)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: String(error) }));
        return true;
      }

      // Retain previous handlers if needed
      switch (message.type) {
        case 'GET_PAGE_INFO':
          sendResponse(this.getPageInfo());
          break;
        case 'ANALYZE_PAGE':
          sendResponse(this.analyzePage());
          break;
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    });
  }

  async performAction(intent) {
    try {
      switch (intent.action) {
        case 'click':
          return this.handleClick(intent.target);
        case 'type':
        case 'search':
          return this.handleType(intent.target, intent.value);
        case 'scroll':
          return this.handleScroll(intent.target);
        // No action needed for "navigate" or "chat"
        default:
          return { success: true, message: 'No page action needed' };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  handleClick(targetDesc) {
    // Try to find a button/link by text
    let el = null;
    if (targetDesc) {
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

  handleType(targetDesc, value) {
    // Try to find input/textarea by label/placeholder or text
    let el = null;
    if (targetDesc) {
      el = [...document.querySelectorAll('input[type=text],input[type=search],input:not([type]),textarea')]
        .find(e =>
          (e.placeholder && e.placeholder.toLowerCase().includes(targetDesc.toLowerCase())) ||
          (e.labels && [...e.labels].some(l => l.textContent && l.textContent.toLowerCase().includes(targetDesc.toLowerCase())))
        );
    }
    if (!el) el = document.querySelector('input,textarea');
    if (el) {
      el.focus();
      el.value = value || "";
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // Optionally, submit the form or press Enter for search
      if (targetDesc && targetDesc.toLowerCase().includes('search')) {
        el.form?.dispatchEvent(new Event('submit', { bubbles: true })) ||
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      }
      return { success: true, message: 'Typed: ' + value };
    } else {
      return { success: false, error: 'Could not find input to type' };
    }
  }

  handleScroll(targetDesc) {
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
      let el = [...document.querySelectorAll('*')]
        .find(e => e.textContent.trim().toLowerCase().includes(targetDesc.toLowerCase()));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return { success: true, message: 'Scrolled to element' };
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return { success: false, error: 'Could not find target element to scroll, scrolled to bottom instead' };
      }
    }
  }

  // Retain previous capability for basics
  getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      timestamp: Date.now()
    };
  }

  analyzePage() {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .slice(0, 10)
      .map(h => ({ level: h.tagName, text: h.textContent.trim().substring(0, 100) }));

    const links = Array.from(document.querySelectorAll('a[href]'))
      .slice(0, 20)
      .map(a => ({ text: a.textContent.trim().substring(0, 50), href: a.href }));

    return {
      url: window.location.href,
      title: document.title,
      headings: headings,
      links: links,
      formCount: document.forms.length,
      imageCount: document.images.length,
      timestamp: Date.now()
    };
  }
}

// Initialize the content script's handler class
const littleGiant = new LittleGiantContentActions();