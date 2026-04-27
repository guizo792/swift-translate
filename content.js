let overlayHost = null;
let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches; // Default to system
const LANGUAGES = {
  "auto": "Detect Language",
  "af": "Afrikaans", "sq": "Albanian", "am": "Amharic", "ar": "Arabic", "hy": "Armenian", "az": "Azerbaijani",
  "eu": "Basque", "be": "Belarusian", "bn": "Bengali", "bs": "Bosnian", "bg": "Bulgarian", "ca": "Catalan",
  "zh-CN": "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)", "hr": "Croatian", "cs": "Czech",
  "da": "Digital", "nl": "Dutch", "en": "English", "et": "Estonian", "fi": "Finnish", "fr": "French",
  "gl": "Galician", "ka": "Georgian", "de": "German", "el": "Greek", "gu": "Gujarati", "he": "Hebrew",
  "hi": "Hindi", "hu": "Hungarian", "is": "Icelandic", "id": "Indonesian", "it": "Italian", "ja": "Japanese",
  "kn": "Kannada", "kk": "Kazakh", "km": "Khmer", "ko": "Korean", "lo": "Lao", "lv": "Latvian",
  "lt": "Lithuanian", "mk": "Macedonian", "ms": "Malay", "ml": "Malayalam", "mr": "Marathi", "mn": "Mongolian",
  "my": "Myanmar (Burmese)", "ne": "Nepali", "no": "Norwegian", "ps": "Pashto", "fa": "Persian", "pl": "Polish",
  "pt": "Portuguese", "pa": "Punjabi", "ro": "Romanian", "ru": "Russian", "sr": "Serbian", "si": "Sinhala",
  "sk": "Slovak", "sl": "Slovenian", "es": "Spanish", "sw": "Swahili", "sv": "Swedish", "ta": "Tamil",
  "te": "Telugu", "th": "Thai", "tr": "Turkish", "uk": "Ukrainian", "ur": "Urdu", "uz": "Uzbek", "vi": "Vietnamese"
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "initiateTranslation") {
    const coords = getSelectionCoords();
    chrome.storage.sync.get({ targetLang: 'en' }, (data) => {
      showOverlay(request.text, 'auto', data.targetLang, coords);
    });
  }
});

function getSelectionCoords() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,      // Top of text
      bottom: rect.bottom + window.scrollY, // Bottom of text
      left: rect.left + window.scrollX,
      viewportBottom: rect.bottom           // Used for space check
    };
  }
  return { top: 100, bottom: 110, left: 100, viewportBottom: 110 };
}

function showOverlay(text, sl, tl, coords) {
  removeOverlay();

  // Decide: Is there enough room at the bottom? (e.g., 300px)
  const spawnAtTop = (window.innerHeight - coords.viewportBottom) < 300;
  
  // If no room at bottom, start at 'top' of text, otherwise start at 'bottom'
  const finalTop = spawnAtTop ? coords.top - 10 : coords.bottom + 10;
  
  overlayHost = document.createElement('div');
  const shadow = overlayHost.attachShadow({ mode: 'open' });
  
  const style = document.createElement('style');
  const updateStyles = () => {
    style.textContent = `
      :host {
        --bg: ${isDark ? '#2d2e31' : '#ffffff'};
        --text: ${isDark ? '#e8eaed' : '#202124'};
        --border: ${isDark ? '#3c4043' : '#dadce0'};
        --footer: ${isDark ? '#202124' : '#f8f9fa'};
        --accent: ${isDark ? '#8ab4f8' : '#1a73e8'};
        --hover: ${isDark ? '#3c4043' : '#f1f3f4'};
      }
      .gt-box {
        position: absolute; 
        top: ${finalTop}px; 
        left: ${coords.left}px;
        /* If spawning at top, shift the whole box up by its own height */
        ${spawnAtTop ? 'transform: translateY(-100%);' : ''}
        z-index: 2147483647; width: 400px; background: var(--bg);
        border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        font-family: 'Segoe UI', Tahoma, sans-serif; border: 1px solid var(--border);
        color: var(--text); animation: fadeIn 0.1s ease-out;
        overflow: hidden;
      }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      
      .gt-header {
        display: flex; align-items: center; padding: 4px 12px;
        border-bottom: 1px solid var(--border); min-height: 40px; box-sizing: border-box;
        justify-content: space-between; /* Safely pins the theme button to the far right */
        width: 100%;
      }
      
      .header-controls { 
        display: flex; align-items: center; gap: 4px; 
      }

      select {
        border: none; background: none; font-size: 13px; color: var(--accent);
        cursor: pointer; font-weight: 600; outline: none; padding: 4px;
      }
      select option { background: var(--bg); color: var(--text); }

      .gt-body { padding: 16px; font-size: 15px; line-height: 1.6; min-height: 40px; }

      .gt-footer {
        display: flex; justify-content: flex-end; padding: 6px 12px;
        background: var(--footer); border-top: 1px solid var(--border); gap: 4px;
      }

      .icon-btn {
        background: none; border: none; cursor: pointer;
        fill: var(--text); opacity: 0.6; border-radius: 4px;
        width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; 
        /* The light animation logic */
        transition: transform 0.1s ease, background 0.1s ease, opacity 0.1s ease;
      }
      
      /* Scale up slightly on hover */
      .icon-btn:hover { 
        opacity: 1; 
        background: var(--hover); 
        transform: scale(1.05); 
      }
      
      /* Scale down slightly to simulate a physical click */
      .icon-btn:active { 
        transform: scale(0.95); 
      }
      
      .icon-btn svg { width: 18px; height: 18px; }
    `;
  };

  const container = document.createElement('div');
  container.className = 'gt-box';
  
  const options = Object.entries(LANGUAGES).map(([c, n]) => `<option value="${c}">${n}</option>`).join('');

  const renderContent = () => {
    // SVG Icons
    const iconVolume = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    const iconCopy = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
    const iconSun = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`;
    const iconMoon = `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;

    container.innerHTML = `
      <div class="gt-header">
        <div class="header-controls">
          <select id="sl">${options}</select>
          <span style="opacity:0.3; font-size: 12px;">⇌</span>
          <select id="tl">${options}</select>
        </div>
        <button id="theme-btn" class="icon-btn" title="Toggle Theme">${isDark ? iconSun : iconMoon}</button>
      </div>
      <div class="gt-body" id="res">...</div>
      <div class="gt-footer">
        <button id="spk" class="icon-btn" title="Listen">${iconVolume}</button>
        <button id="cpy" class="icon-btn" title="Copy">${iconCopy}</button>
      </div>
    `;
  };

  updateStyles();
  renderContent();
  shadow.appendChild(style);
  shadow.appendChild(container);
  document.body.appendChild(overlayHost);

  const slEl = container.querySelector('#sl');
  const tlEl = container.querySelector('#tl');
  const resEl = container.querySelector('#res');
  slEl.value = sl;
  tlEl.value = tl;

  const fetchUpdate = () => {
    resEl.innerText = "...";
    chrome.runtime.sendMessage({
      action: "fetchTranslation",
      text: text,
      sl: slEl.value,
      tl: tlEl.value
    }, r => { resEl.innerText = r.translated || "Error"; });
  };

  // UI Event Handlers
  container.querySelector('#theme-btn').onclick = (e) => {
    e.stopPropagation();
    isDark = !isDark;
    updateStyles();
    container.querySelector('#theme-btn').innerText = isDark ? '☀️' : '🌙';
  };

  slEl.onchange = fetchUpdate;
  tlEl.onchange = fetchUpdate;
  container.querySelector('#cpy').onclick = () => navigator.clipboard.writeText(resEl.innerText);
  container.querySelector('#spk').onclick = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(resEl.innerText);
    
    // Get all available voices
    const voices = window.speechSynthesis.getVoices();
    
    // Logic to find a high-quality voice for the target language
    // It looks for "Google" or "Natural" in the name, which are usually better
    const bestVoice = voices.find(v => 
      v.lang.startsWith(tlEl.value) && 
      (v.name.includes("Google") || v.name.includes("Natural"))
    ) || voices.find(v => v.lang.startsWith(tlEl.value));

    if (bestVoice) {
      u.voice = bestVoice;
    }
    
    u.lang = tlEl.value;
    u.rate = 1.0; // Standard speed
    window.speechSynthesis.speak(u);
  };

  // Crucial: Chrome loads voices asynchronously. 
  // This helps ensure they are ready when the popup opens.
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };

  const handleDocClick = (e) => {
    if (!e.composedPath().includes(overlayHost)) {
      removeOverlay();
      document.removeEventListener('mousedown', handleDocClick);
    }
  };

  setTimeout(() => document.addEventListener('mousedown', handleDocClick), 0);
  fetchUpdate();
}

function removeOverlay() {
  if (overlayHost) {
    window.speechSynthesis.cancel();
    overlayHost.remove();
    overlayHost = null;
  }
}