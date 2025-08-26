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
          return this.handleScroll(intent.target, intent.value);
        // No action needed for "navigate" or "chat"
        default:
          return { success: true, message: 'No page action needed' };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

handleClick(targetDesc) {
  if (!targetDesc) {
    return { success: false, error: 'No target description provided' };
  }

  targetDesc = targetDesc.toLowerCase();
  let el = null;

  // Look for common clickable elements
  const candidates = [
    ...document.querySelectorAll(
      'button, input[type=button], input[type=submit], a, [role=button]'
    )
  ];

  el = candidates.find(e =>
    (e.textContent && e.textContent.trim().toLowerCase().includes(targetDesc)) ||
    (e.value && e.value.toLowerCase().includes(targetDesc)) ||
    (e.getAttribute('aria-label') && e.getAttribute('aria-label').toLowerCase().includes(targetDesc)) ||
    (e.getAttribute('title') && e.getAttribute('title').toLowerCase().includes(targetDesc)) ||
    (e.name && e.name.toLowerCase().includes(targetDesc))
  );

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  handleScroll(targetDesc, direction) {
  // Wait a moment for DOM to be ready
  setTimeout(() => {
    const dir = (direction || '').toLowerCase();
    const step = Math.max(200, Math.floor(window.innerHeight * 0.9));

    console.log('🔄 Attempting scroll:', dir, 'Step size:', step);
    console.log('📏 Page dimensions:', {
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      currentScrollY: window.scrollY
    });

    if (dir.includes('top')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      console.log('✅ Scrolled to top');
    } else if (dir.includes('bottom') || dir.includes('end')) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      console.log('✅ Scrolled to bottom');
    } else if (dir.includes('up')) {
      window.scrollBy({ top: -step, behavior: 'smooth' });
      console.log('✅ Scrolled up by', step);
    } else if (dir.includes('down')) {
      window.scrollBy({ top: step, behavior: 'smooth' });
      console.log('✅ Scrolled down by', step);
    } else {
      // Default to bottom
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      console.log('✅ Default scroll to bottom');
    }
  }, 100); // Small delay to ensure DOM is ready

  return { success: true, message: `Scroll initiated: ${direction || 'bottom'}` };
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