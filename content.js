let overlayHost = null;
let isDark = window.matchMedia("(prefers-color-scheme: dark)").matches; // Default to system

const LANGUAGES = {
  auto: "Detect Language",
  af: "Afrikaans",
  sq: "Albanian",
  am: "Amharic",
  ar: "Arabic",
  hy: "Armenian",
  az: "Azerbaijani",
  eu: "Basque",
  be: "Belarusian",
  bn: "Bengali",
  bs: "Bosnian",
  bg: "Bulgarian",
  ca: "Catalan",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  hr: "Croatian",
  cs: "Czech",
  da: "Danish",
  nl: "Dutch",
  en: "English",
  et: "Estonian",
  fi: "Finnish",
  fr: "French",
  gl: "Galician",
  ka: "Georgian",
  de: "German",
  el: "Greek",
  gu: "Gujarati",
  he: "Hebrew",
  hi: "Hindi",
  hu: "Hungarian",
  is: "Icelandic",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  kn: "Kannada",
  kk: "Kazakh",
  km: "Khmer",
  ko: "Korean",
  lo: "Lao",
  lv: "Latvian",
  lt: "Lithuanian",
  mk: "Macedonian",
  ms: "Malay",
  ml: "Malayalam",
  mr: "Marathi",
  mn: "Mongolian",
  my: "Myanmar (Burmese)",
  ne: "Nepali",
  no: "Norwegian",
  ps: "Pashto",
  fa: "Persian",
  pl: "Polish",
  pt: "Portuguese",
  pa: "Punjabi",
  ro: "Romanian",
  ru: "Russian",
  sr: "Serbian",
  si: "Sinhala",
  sk: "Slovak",
  sl: "Slovenian",
  es: "Spanish",
  sw: "Swahili",
  sv: "Swedish",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  uz: "Uzbek",
  vi: "Vietnamese",
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "initiateTranslation") {
    const coords = getSelectionCoords();
    chrome.storage.sync.get(
      {
        sourceLang: "auto",
        targetLang: "en",
        theme: window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      },
      (data) => {
        isDark = data.theme === "dark";
        showOverlay(request.text, data.sourceLang, data.targetLang, coords);
      },
    );
  }
});

function getSelectionCoords() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return {
      rect: rect,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      viewportBottom: rect.bottom,
    };
  }
  return null;
}

function showOverlay(originalText, initialSl, initialTl, coords) {
  if (!coords) return;
  removeOverlay();

  const spawnAtTop = window.innerHeight - coords.viewportBottom < 320;
  const finalTop = spawnAtTop ? coords.top - 10 : coords.bottom + 10;

  overlayHost = document.createElement("div");
  const shadow = overlayHost.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  container.className = "gt-box";

  const style = document.createElement("style");
  const updateStyles = () => {
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

      :host {
        --bg: ${isDark ? "#2d2e31" : "#ffffff"};
        --text: ${isDark ? "#e8eaed" : "#202124"};
        --border: ${isDark ? "#3c4043" : "#dadce0"};
        --footer: ${isDark ? "#202124" : "#f8f9fa"};
        --accent: ${isDark ? "#8ab4f8" : "#1a73e8"};
        --hover: ${isDark ? "#3c4043" : "#f1f3f4"};
      }
      .gt-box {
        position: absolute; top: ${finalTop}px; left: ${coords.left}px;
        z-index: 2147483647; width: 460px; background: var(--bg);
        border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        font-family: 'Plus Jakarta Sans', sans-serif;
        border: 1px solid var(--border); color: var(--text);
        overflow: hidden; display: flex; flex-direction: column;
        ${spawnAtTop ? "transform: translateY(-100%);" : ""}
        animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideIn { from { opacity: 0; scale: 0.98; } to { opacity: 1; scale: 1; } }
      
      .gt-header { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--border); justify-content: space-between; }
      .header-controls { display: flex; align-items: center; gap: 4px; }
      .logo-icon { width: 18px; height: 18px; fill: var(--accent); margin-right: 4px; }
      
      select { border: none; background: none; font-size: 13px; color: var(--accent); cursor: pointer; font-weight: 700; font-family: inherit; outline: none; }
      .rev-btn { background: none; border: none; cursor: pointer; color: var(--text); opacity: 0.3; font-size: 14px; transition: 0.2s; }
      .rev-btn:hover { opacity: 1; color: var(--accent); transform: rotate(180deg); }

      .gt-body { padding: 16px; font-size: 15px; line-height: 1.6; max-height: 280px; overflow-y: auto; min-height: 60px; }

      .gt-footer { display: flex; align-items: center; justify-content: flex-end; padding: 6px 12px; background: var(--footer); border-top: 1px solid var(--border); gap: 6px; }

      .icon-btn {
        background: none; border: none; cursor: pointer; fill: var(--text);
        opacity: 0.5; width: 34px; height: 34px; display: flex;
        align-items: center; justify-content: center; border-radius: 8px;
        transition: all 0.2s ease;
      }
      .icon-btn:hover { opacity: 1; background: var(--hover); }
      .icon-btn:active { transform: scale(0.9); }
      .icon-btn.success { fill: #10b981; opacity: 1; background: rgba(16, 185, 129, 0.1); }
      .icon-btn svg { width: 18px; height: 18px; transition: 0.2s; }
      
      #spk { margin-right: auto; } /* Keep speaker on the left */
    `;
  };

  const renderContent = () => {
    const iconVol = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
    const iconCpy = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
    const iconCheck = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    // New Web/Globe Icon
    const iconWeb = `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg>`;
    const iconSun = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.99 4.58zm12.02 12.02a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.42-1.42zM18.01 4.58a.996.996 0 00-1.41 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.42-1.42a.996.996 0 00-1.41 0zM5.99 16.6a.996.996 0 00-1.41 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.42-1.42z"/></svg>`;
    const iconMoon = `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;

    const opts = Object.entries(LANGUAGES)
      .map(([c, n]) => `<option value="${c}">${n}</option>`)
      .join("");

    container.innerHTML = `
      <div class="gt-header">
        <div class="header-controls">
          <svg style="width:18px;height:18px;fill:var(--accent);margin-right:4px;" viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
          <select id="sl">${opts}</select>
          <button id="rev-btn" class="rev-btn">⇌</button>
          <select id="tl">${opts}</select>
        </div>
        <button id="theme-btn" class="icon-btn">${isDark ? iconSun : iconMoon}</button>
      </div>
      <div class="gt-body" id="res">...</div>
      <div class="gt-footer">
        <button id="spk" class="icon-btn" title="Speak">${iconVol}</button>
        <button id="search" class="icon-btn" title="Search on Google">${iconWeb}</button>
        <button id="cpy" class="icon-btn" title="Copy">${iconCpy}</button>
      </div>
    `;
    setupEventListeners(iconCpy, iconCheck);
  };

  const setupEventListeners = (iconCpy, iconCheck) => {
    const slEl = container.querySelector("#sl");
    const tlEl = container.querySelector("#tl");
    const resEl = container.querySelector("#res");

    const fetchUpdate = () => {
      resEl.innerText = "...";
      chrome.runtime.sendMessage(
        {
          action: "fetchTranslation",
          text: originalText,
          sl: slEl.value,
          tl: tlEl.value,
        },
        (r) => {
          resEl.innerText = r.translated || "Error";
        },
      );
    };

    container.querySelector("#rev-btn").onclick = () => {
      const oldSl = slEl.value;
      slEl.value = tlEl.value;
      tlEl.value = oldSl === "auto" ? "en" : oldSl;
      chrome.storage.sync.set({
        sourceLang: slEl.value,
        targetLang: tlEl.value,
      });
      fetchUpdate();
    };

    slEl.onchange = () => {
      chrome.storage.sync.set({ sourceLang: slEl.value });
      fetchUpdate();
    };
    tlEl.onchange = () => {
      chrome.storage.sync.set({ targetLang: tlEl.value });
      fetchUpdate();
    };

    container.querySelector("#theme-btn").onclick = () => {
      const state = { sl: slEl.value, tl: tlEl.value, res: resEl.innerText };
      isDark = !isDark;
      chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
      updateStyles();
      renderContent();
      container.querySelector("#sl").value = state.sl;
      container.querySelector("#tl").value = state.tl;
      container.querySelector("#res").innerText = state.res;
    };

    container.querySelector("#cpy").onclick = (e) => {
      const btn = e.currentTarget;
      navigator.clipboard.writeText(resEl.innerText);
      btn.innerHTML = iconCheck;
      btn.classList.add("success");
      setTimeout(() => {
        btn.innerHTML = iconCpy;
        btn.classList.remove("success");
      }, 1500);
    };

    container.querySelector("#search").onclick = () => {
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(resEl.innerText)}`,
        "_blank",
      );
    };

    container.querySelector("#spk").onclick = () => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(resEl.innerText);
      const voices = window.speechSynthesis.getVoices();
      const best =
        voices.find(
          (v) =>
            v.lang.startsWith(tlEl.value) &&
            (v.name.includes("Google") || v.name.includes("Natural")),
        ) || voices.find((v) => v.lang.startsWith(tlEl.value));
      if (best) u.voice = best;
      u.lang = tlEl.value;
      window.speechSynthesis.speak(u);
    };
  };

  updateStyles();
  renderContent();
  shadow.appendChild(style);
  shadow.appendChild(container);
  document.body.appendChild(overlayHost);
  container.querySelector("#sl").value = initialSl;
  container.querySelector("#tl").value = initialTl;

  const handleDocClick = (e) => {
    if (!e.composedPath().includes(overlayHost)) removeOverlay();
  };
  setTimeout(() => document.addEventListener("mousedown", handleDocClick), 0);
  chrome.runtime.sendMessage(
    {
      action: "fetchTranslation",
      text: originalText,
      sl: initialSl,
      tl: initialTl,
    },
    (r) => {
      container.querySelector("#res").innerText = r.translated || "Error";
    },
  );
}

function removeOverlay() {
  if (overlayHost) {
    window.speechSynthesis.cancel();
    overlayHost.remove();
    overlayHost = null;
  }
}
