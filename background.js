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

// Listen for translation requests from the UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchTranslation") {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${request.sl}&tl=${request.tl}&dt=t&q=${encodeURIComponent(request.text)}`;
    
    const attempt = () =>
      fetch(url).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    // gtx is unofficial and sometimes fails transiently (rate limit), so retry once
    attempt()
      .catch(() => new Promise(r => setTimeout(r, 600)).then(attempt))
      .then(data => {
        let translatedText = "";
        if (data && data[0]) {
          data[0].forEach(segment => { if (segment[0]) translatedText += segment[0]; });
        }
        sendResponse({ translated: translatedText });
      })
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep channel open for async response
  }
});