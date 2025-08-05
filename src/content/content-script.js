// Little Giant AI - Content Script
console.log('🏔️ Little Giant content script loaded on:', window.location.href);

class LittleGiantContent {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Content script received:', message.type);

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

// Initialize content script
const littleGiant = new LittleGiantContent();