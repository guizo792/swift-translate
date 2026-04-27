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
    
    fetch(url)
      .then(res => res.json())
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