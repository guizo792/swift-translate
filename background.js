chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate Selection",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "translate-selection") {
    // We send an empty request first to trigger the content script to find the selection 
    // and then call back for the translation with its own default languages.
    chrome.tabs.sendMessage(tab.id, { action: "initiateTranslation", text: info.selectionText });
  }
});

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

// Google refuses lookups that come too close together, and keeps refusing for a while. After a refusal we
// stop sending translation requests for a short time: more requests only make the block last longer.
const COOLDOWN_MS = 30_000;
let blockedUntil = 0;

const openVocab = () => chrome.tabs.create({ url: chrome.runtime.getURL("vocab.html") });

// The toolbar button opens the saved-words page
chrome.action.onClicked.addListener(openVocab);

// Listen for translation requests from the UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // A content script can't open an extension page itself
  if (request.action === "openVocab") {
    openVocab();
    return;
  }
  // Google's own spoken audio, which sounds the same as in Google Translate and covers
  // languages like Arabic that many computers have no installed voice for
  if (request.action === "fetchSpeech") {
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${request.lang}&q=${encodeURIComponent(request.text)}`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buffer => sendResponse({ dataUrl: `data:audio/mpeg;base64,${toBase64(buffer)}` }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === "fetchTranslation") {
    if (Date.now() < blockedUntil) {
      sendResponse({ error: "rate limited", rateLimited: true });
      return;
    }
    // Dictionary data only makes sense for a single word
    const isWord = !/\s/.test(request.text.trim());
    // dt=ex is what adds the example sentence to each definition in data[12]
    const dt = isWord ? "&dt=bd&dt=md&dt=ss&dt=ex" : "";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${request.sl}&tl=${request.tl}&dt=t&dt=rm${dt}&q=${encodeURIComponent(request.text)}`;

    const attempt = () =>
      fetch(url).then(res => {
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        return res.json();
      });

    // Retry once for network and server errors. A 4xx (rate limit, text too long)
    // won't succeed 600ms later, and more requests only make rate limiting worse.
    attempt()
      .catch(err => {
        if (err.status >= 400 && err.status < 500) throw err;
        return new Promise(r => setTimeout(r, 600)).then(attempt);
      })
      .then(data => {
        let translatedText = "";
        if (data && data[0]) {
          data[0].forEach(segment => { if (segment[0]) translatedText += segment[0]; });
        }
        // The romanization segment looks like [null, null, targetRomanized, sourceRomanized]
        const romanized = data && data[0] ? data[0].map(segment => segment[2]).find(Boolean) : null;
        sendResponse({
          translated: translatedText,
          detected: data && data[2],
          romanized: romanized && romanized.toLowerCase() !== translatedText.toLowerCase() ? romanized : null,
          dictionary: isWord ? parseDictionary(data) : [],
        });
      })
      .catch(err => {
        const rateLimited = err.status === 429;
        if (rateLimited) blockedUntil = Date.now() + COOLDOWN_MS;
        sendResponse({ error: err.message, rateLimited });
      });
    return true; // Keep channel open for async response
  }
});

// Merges gtx's translations (data[1]), synonyms (data[11]) and definitions (data[12]) by part of speech
function parseDictionary(data) {
  const byPos = new Map();
  const entry = pos => {
    if (!byPos.has(pos)) byPos.set(pos, { pos, terms: [], definitions: [], synonyms: [] });
    return byPos.get(pos);
  };
  (data[1] || []).forEach(([pos, terms]) => {
    entry(pos).terms = (terms || []).slice(0, 5);
  });
  (data[12] || []).forEach(([pos, definitions]) => {
    entry(pos).definitions = (definitions || []).slice(0, 3).map(([text, , example]) => ({ text, example }));
  });
  (data[11] || []).forEach(([pos, groups]) => {
    // Groups with a label (g[2]) are niche usage like "literary", so leave them out
    const words = (groups || []).filter(g => !g[2]).flatMap(g => g[0] || []);
    entry(pos).synonyms = [...new Set(words)].slice(0, 6);
  });
  return [...byPos.values()];
}