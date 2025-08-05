// summarizer.js

export async function summarizePage(data, aiProvider) {
  if (!aiProvider) {
    return {
      success: false,
      error: 'AI provider not initialized',
    };
  }

  const { title, url, headings = [], links = [], formCount, imageCount } = data;

  // Build a prompt from page structure
  const prompt = `
You're an AI assistant. Summarize the purpose and content of the following webpage:

Title: ${title}
URL: ${url}

Headings:
${headings.map(h => `${h.level}: ${h.text}`).join('\n')}

Top Links:
${links.map(l => `- ${l.text} (${l.href})`).join('\n')}

Other Info:
- Forms: ${formCount}
- Images: ${imageCount}

Write a concise and helpful summary:
`;

  const messages = [
    { role: 'user', content: prompt }
  ];

  try {
    const result = await aiProvider.chat(messages);

    return {
      success: true,
      message: result.content,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
