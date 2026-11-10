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

// The sentence a short selection came from, saved with the word as a reminder of its meaning
function getContextSentence(text) {
  const sel = window.getSelection();
  const word = text.replace(/\s+/g, " ").trim();
  if (!sel || !sel.rangeCount || word.length > 120) return "";
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  // Climb out of inline tags (<b>, <a>) so the sentence isn't cut short
  while (node && node.parentElement && getComputedStyle(node).display.startsWith("inline")) {
    node = node.parentElement;
  }
  const block = (node ? node.textContent : "").replace(/\s+/g, " ");
  const at = block.indexOf(word);
  if (at < 0) return "";
  let start = 0;
  for (const sentence of block.match(/[^.!?]+[.!?]*\s*/g) || []) {
    if (at < start + sentence.length) return sentence.trim().slice(0, 300);
    start += sentence.length;
  }
  return "";
}

function startTranslation(text) {
  removeSelectionIcon();
  const coords = getSelectionCoords();
  const context = getContextSentence(text);
  chrome.storage.sync.get(
    {
      sourceLang: "auto",
      targetLang: "en",
      recentLangs: [],
      theme: window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    },
    (data) => {
      isDark = data.theme === "dark";
      recentLanguages = data.recentLangs;
      showOverlay(text, data.sourceLang, data.targetLang, coords, context);
    },
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "initiateTranslation") {
    startTranslation(request.text);
  }
});

// --- Selection popup: small icon that appears next to selected text ---
let iconHost = null;

function removeSelectionIcon() {
  if (iconHost) {
    iconHost.remove();
    iconHost = null;
  }
}

function showSelectionIcon(text, rect) {
  removeSelectionIcon();
  // Match the popup's theme, which the user picks with the sun/moon button
  chrome.storage.sync.get(
    { theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" },
    ({ theme }) => {
      // The selection may have changed while storage was being read
      if (window.getSelection().toString().trim() !== text) return;
      buildSelectionIcon(text, rect, theme === "dark");
    },
  );
}

function buildSelectionIcon(text, rect, dark) {
  removeSelectionIcon();
  iconHost = document.createElement("div");
  const shadow = iconHost.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      button {
        position: absolute; z-index: 2147483647; width: 30px; height: 30px;
        top: ${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 38)) + window.scrollY}px;
        left: ${Math.max(8, Math.min(rect.right + window.scrollX, window.scrollX + window.innerWidth - 38))}px;
        border-radius: 8px; border: 1px solid ${dark ? "#3c4043" : "#dadce0"};
        background: ${dark ? "#2d2e31" : "#ffffff"};
        box-shadow: 0 2px 8px rgba(0,0,0,0.2); cursor: pointer; padding: 0;
        display: flex; align-items: center; justify-content: center;
      }
      button:hover { background: ${dark ? "#3c4043" : "#f1f3f4"}; }
      svg { width: 18px; height: 18px; fill: ${dark ? "#8ab4f8" : "#1a73e8"}; }
    </style>
    <button title="Translate"><svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg></button>
  `;
  const btn = shadow.querySelector("button");
  // Keep the text selected when the icon is pressed
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => startTranslation(text));
  document.body.appendChild(iconHost);
}

function isEditable(node) {
  return (
    node &&
    (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName))
  );
}

document.addEventListener("mouseup", (e) => {
  // Left button only: a right-click opens the context menu, which has its own entry
  if (e.button !== 0) return;
  // After an extension reload or update, this old script can no longer use chrome.* APIs
  if (!chrome.runtime?.id) return;
  if (e.composedPath().includes(iconHost) || e.composedPath().includes(overlayHost)) return;
  // Don't get in the way while the user is editing text
  if (isEditable(e.composedPath()[0]) || isEditable(document.activeElement)) return;
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (!text || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    showSelectionIcon(text, rect);
  }, 0);
});

document.addEventListener("mousedown", (e) => {
  if (!e.composedPath().includes(iconHost)) removeSelectionIcon();
  if (!e.composedPath().includes(overlayHost)) removeOverlay();
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

// How well a language matches what was typed: lower is better, -1 is no match.
function matchRank(name, code, query) {
  const n = name.toLowerCase();
  const c = code.toLowerCase();
  if (n.startsWith(query) || c === query) return 0;
  if (n.split(/[\s(]+/).some((word) => word.startsWith(query))) return 1;
  if (n.includes(query)) return 2;
  if (c.startsWith(query)) return 3;
  return -1;
}

const RECENT_LANGUAGES = 3;
let recentLanguages = []; // loaded when a popup opens, so a picker can open without waiting for storage

function rememberLanguage(code) {
  if (code === "auto") return;
  recentLanguages = [code, ...recentLanguages.filter((c) => c !== code)].slice(0, RECENT_LANGUAGES);
  chrome.storage.sync.set({ recentLangs: recentLanguages });
}

// A language chooser with a search box, in place of a plain <select>. To the rest of the code it looks like
// one: it has a `value`, and calls `onchange` when the user picks a language. The list opens in a panel next
// to the popup (not inside it, so it isn't clipped by the popup's edges).
function createLanguagePicker(shadow, id, { includeAuto }) {
  const root = document.createElement("div");
  root.id = id;
  root.className = "lang-picker";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lang-btn";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const label = document.createElement("span");
  button.append(label);
  root.append(button);

  const entries = Object.entries(LANGUAGES).filter(([code]) => includeAuto || code !== "auto");
  let value = includeAuto ? "auto" : "en";
  const show = () => {
    label.textContent = LANGUAGES[value] ?? value;
    root.dataset.value = value;
  };
  Object.defineProperty(root, "value", {
    get: () => value,
    set: (v) => {
      value = v;
      show();
    },
  });
  show();

  let panel = null;
  let stopListening = () => {};
  const close = () => {
    stopListening();
    panel?.remove();
    panel = null;
    button.setAttribute("aria-expanded", "false");
  };

  const open = (recent) => {
    shadow.querySelectorAll(".lang-panel").forEach((p) => p.remove());
    panel = document.createElement("div");
    panel.className = "lang-panel";
    const input = document.createElement("input");
    input.className = "lang-search";
    input.type = "text";
    input.placeholder = "Search languages";
    input.setAttribute("aria-label", "Search languages");
    input.autocomplete = "off";
    input.spellcheck = false;
    const list = document.createElement("ul");
    list.className = "lang-list";
    list.setAttribute("role", "listbox");
    panel.append(input, list);

    // Below the button if there is room, otherwise above it, and never off the window's edge. It is placed in
    // page coordinates like the popup itself, so it stays with the button when the page scrolls.
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const openUp = below < 240 && above > below;
    panel.style.left = `${window.scrollX + Math.max(8, Math.min(rect.left, window.innerWidth - 248))}px`;
    panel.style.maxHeight = `${Math.min(320, openUp ? above : below)}px`;
    panel.style.top = `${window.scrollY + rect.bottom + 4}px`;
    shadow.append(panel);
    if (openUp) panel.style.top = `${window.scrollY + rect.top - panel.offsetHeight - 4}px`;
    button.setAttribute("aria-expanded", "true");

    let options = [];
    let active = 0;
    const setActive = (index) => {
      options[active]?.classList.remove("active");
      active = index;
      const li = options[active];
      if (!li) return;
      li.classList.add("active");
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
      }
    };
    const choose = (code) => {
      value = code;
      show();
      rememberLanguage(code);
      close();
      button.focus();
      root.onchange?.();
    };
    const add = (tag, className, text) => {
      const li = document.createElement(tag);
      li.className = className;
      li.textContent = text;
      list.append(li);
      return li;
    };
    const addOption = ([code, name]) => {
      const li = add("li", `lang-option${code === value ? " current" : ""}`, name);
      li.setAttribute("role", "option");
      li.dataset.value = code;
      li.addEventListener("click", () => choose(code));
      li.addEventListener("mousemove", () => {
        if (options[active] !== li) setActive(options.indexOf(li));
      });
      options.push(li);
    };

    const draw = () => {
      const query = input.value.trim().toLowerCase();
      list.replaceChildren();
      options = [];
      if (query) {
        entries
          .map((entry) => [matchRank(entry[1], entry[0], query), entry])
          .filter(([rank]) => rank >= 0)
          .sort((a, b) => a[0] - b[0]) // a stable sort: equal matches stay in alphabetical order
          .forEach(([, entry]) => addOption(entry));
        if (!options.length) add("li", "lang-empty", "No language found");
        setActive(0);
        return;
      }
      const recents = recent.map((code) => entries.find(([c]) => c === code)).filter(Boolean);
      if (recents.length) {
        add("li", "lang-heading", "Recent").setAttribute("role", "presentation");
        recents.forEach(addOption);
        add("li", "lang-heading", "All languages").setAttribute("role", "presentation");
      }
      entries.forEach(addOption);
      setActive(Math.max(0, options.findIndex((li) => li.dataset.value === value)));
    };
    draw();

    input.addEventListener("input", draw);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // typing here must not trigger the page's own keyboard shortcuts
      if (e.isComposing) return;
      if (e.key === "ArrowDown" && options.length) setActive((active + 1) % options.length);
      else if (e.key === "ArrowUp" && options.length) setActive((active - 1 + options.length) % options.length);
      else if (e.key === "Enter" && options[active]) choose(options[active].dataset.value);
      else if (e.key === "Escape") {
        close();
        button.focus();
      } else return;
      e.preventDefault();
    });
    for (const type of ["keyup", "keypress"]) input.addEventListener(type, (e) => e.stopPropagation());

    // Close on a click elsewhere in the popup, or when the window is resized.
    const onMouseDown = (e) => {
      const path = e.composedPath();
      if (!path.includes(panel) && !path.includes(button)) close();
    };
    shadow.addEventListener("mousedown", onMouseDown);
    window.addEventListener("resize", close);
    stopListening = () => {
      shadow.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", close);
    };
    input.focus({ preventScroll: true });
  };

  button.addEventListener("click", () => (panel?.isConnected ? close() : open(recentLanguages)));
  return root;
}

function showOverlay(originalText, initialSl, initialTl, coords, context = "") {
  if (!coords) return;
  removeOverlay();

  // Open on whichever side of the selection has room, and shrink the body to fit
  const spaceBelow = window.innerHeight - coords.viewportBottom;
  const spaceAbove = coords.rect.top;
  let spawnAtTop = spaceBelow < 400 && spaceAbove > spaceBelow;
  let finalTop = spawnAtTop ? coords.top - 10 : coords.bottom + 10;
  let room = Math.max(spaceAbove, spaceBelow) - 18;
  if (room < 240) {
    // The selection fills the screen: overlap it, pinned inside the viewport
    spawnAtTop = false;
    room = Math.min(400, window.innerHeight - 16);
    finalTop = window.scrollY + window.innerHeight - room - 8;
  }
  const bodyMaxHeight = Math.max(60, Math.min(280, room - 130)); // 130px = header, footer and body padding
  // Keep the 460px box inside the viewport horizontally
  const finalLeft = Math.max(
    window.scrollX + 8,
    Math.min(coords.left, window.scrollX + window.innerWidth - 460 - 16),
  );

  overlayHost = document.createElement("div");
  const shadow = overlayHost.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  container.className = "gt-box";

  const style = document.createElement("style");
  const updateStyles = () => {
    style.textContent = `
      :host {
        --bg: ${isDark ? "#2d2e31" : "#ffffff"};
        --text: ${isDark ? "#e8eaed" : "#202124"};
        --border: ${isDark ? "#3c4043" : "#dadce0"};
        --footer: ${isDark ? "#202124" : "#f8f9fa"};
        --accent: ${isDark ? "#8ab4f8" : "#1a73e8"};
        --hover: ${isDark ? "#3c4043" : "#f1f3f4"};
      }
      .gt-box {
        position: absolute; top: ${finalTop}px; left: ${finalLeft}px;
        z-index: 2147483647; width: 460px; max-width: calc(100vw - 16px); background: var(--bg);
        border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        border: 1px solid var(--border); color: var(--text);
        overflow: hidden; display: flex; flex-direction: column;
        ${spawnAtTop ? "transform: translateY(-100%);" : ""}
        animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideIn { from { opacity: 0; scale: 0.98; } to { opacity: 1; scale: 1; } }
      
      .gt-header { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--border); justify-content: space-between; }
      .header-controls { display: flex; align-items: center; gap: 4px; }
      .logo-icon { width: 18px; height: 18px; fill: var(--accent); margin-right: 4px; }
      
      .lang-picker { position: relative; }
      .lang-btn { display: flex; align-items: center; gap: 6px; max-width: 170px; padding: 6px 8px; border: none; border-radius: 8px; background: none; cursor: pointer; color: var(--accent); font: inherit; font-size: 14px; font-weight: 700; }
      .lang-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lang-btn::after { content: ""; flex: none; border: 4px solid transparent; border-top-color: currentColor; border-bottom-width: 0; opacity: 0.7; }
      .lang-btn:hover, .lang-btn[aria-expanded="true"] { background: var(--hover); }
      .lang-panel { position: absolute; z-index: 2147483647; width: 240px; display: flex; flex-direction: column; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 28px rgba(0,0,0,0.3); overflow: hidden; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color-scheme: ${isDark ? "dark" : "light"}; }
      .lang-search { margin: 8px; padding: 8px 10px; font: inherit; font-size: 14px; color: var(--text); background: var(--footer); border: 1px solid var(--border); border-radius: 8px; outline: none; }
      .lang-search:focus { border-color: var(--accent); }
      .lang-list { position: relative; list-style: none; margin: 0; padding: 0 0 6px; overflow-y: auto; }
      .lang-heading { padding: 6px 14px 2px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.55; }
      .lang-option { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 14px; cursor: pointer; }
      .lang-option.active { background: var(--hover); }
      .lang-option.current { color: var(--accent); font-weight: 700; }
      .lang-empty { padding: 12px 14px; font-size: 14px; opacity: 0.6; }
      .rev-btn { background: none; border: none; cursor: pointer; color: var(--text); opacity: 0.3; font-size: 14px; transition: 0.2s; }
      .rev-btn:hover { opacity: 1; color: var(--accent); transform: rotate(180deg); }

      .gt-body { padding: 16px; font-size: 18px; line-height: 1.6; max-height: ${bodyMaxHeight}px; overflow-y: auto; min-height: 60px; }

      .src-row { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 8px; }
      .src { flex: 1; min-width: 0; font-size: 14px; line-height: 1.45; opacity: 0.65; cursor: text; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
      .src:hover { opacity: 1; }
      .src.editing { display: block; opacity: 1; overflow: visible; }
      .src-edit { flex: none; width: 24px; height: 24px; padding: 0; border: none; border-radius: 6px; background: none; cursor: pointer; fill: var(--text); opacity: 0.45; display: flex; align-items: center; justify-content: center; }
      .src-edit:hover { opacity: 1; background: var(--hover); }
      .src-edit svg { width: 15px; height: 15px; }
      .src-input { display: block; width: 100%; box-sizing: border-box; max-height: 110px; padding: 6px 8px; resize: none; font: inherit; font-size: 14px; line-height: 1.45; color: var(--text); background: var(--footer); border: 1px solid var(--accent); border-radius: 8px; outline: none; }

      .romanized, .note { font-size: 14px; opacity: 0.65; margin-top: 4px; }
      .dict-toggle { display: block; margin-top: 8px; padding: 0; border: none; background: none; cursor: pointer; color: var(--text); font: inherit; font-size: 14px; text-decoration: underline; opacity: 0.65; }
      .dict-toggle:hover { color: var(--accent); opacity: 1; }
      .dict { margin-top: 12px; padding-top: 4px; border-top: 1px solid var(--border); font-size: 14px; line-height: 1.5; }
      .pos { color: var(--accent); font-weight: 700; font-size: 12px; text-transform: capitalize; margin-top: 8px; }
      .def-example, .synonyms { opacity: 0.65; }
      .def-example { font-style: italic; }
      .dict ol { margin: 2px 0; padding-left: 20px; }

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
      .icon-btn.saved { fill: #f5b400; opacity: 1; }
      .icon-btn svg { width: 18px; height: 18px; transition: 0.2s; }
      
      #spk { margin-right: auto; } /* Keep speaker on the left */
    `;
  };

  const renderContent = () => {
    const iconVol = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
    const iconCpy = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
    const iconCheck = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    const iconStar = `<svg viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>`;
    const iconStarFilled = `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
    const iconBook = `<svg viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>`;
    const iconPencil = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
    // New Web/Globe Icon
    const iconWeb = `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg>`;
    const iconSun = `<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L5.99 4.58zm12.02 12.02a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.42-1.42zM18.01 4.58a.996.996 0 00-1.41 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.42-1.42a.996.996 0 00-1.41 0zM5.99 16.6a.996.996 0 00-1.41 1.41l1.42 1.42c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.42-1.42z"/></svg>`;
    const iconMoon = `<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`;

    container.innerHTML = `
      <div class="gt-header">
        <div class="header-controls">
          <svg style="width:18px;height:18px;fill:var(--accent);margin-right:4px;" viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
          <div id="sl"></div>
          <button id="rev-btn" class="rev-btn">⇌</button>
          <div id="tl"></div>
        </div>
        <button id="theme-btn" class="icon-btn">${isDark ? iconSun : iconMoon}</button>
      </div>
      <div class="gt-body">
        <div class="src-row"><div id="src" class="src" title="Edit text"></div><button id="src-edit" class="src-edit" title="Edit text">${iconPencil}</button></div>
        <div id="res">...</div><div id="extra"></div>
      </div>
      <div class="gt-footer">
        <button id="spk" class="icon-btn" title="Speak">${iconVol}</button>
        <button id="star" class="icon-btn" title="Save to vocabulary">${iconStar}</button>
        <button id="vocab-btn" class="icon-btn" title="Saved words">${iconBook}</button>
        <button id="search" class="icon-btn" title="Search on Google">${iconWeb}</button>
        <button id="cpy" class="icon-btn" title="Copy">${iconCpy}</button>
      </div>
    `;
    // The language pickers replace these placeholders. A panel left open from before a rebuild goes too.
    shadow.querySelectorAll(".lang-panel").forEach((p) => p.remove());
    container.querySelector("#sl").replaceWith(createLanguagePicker(shadow, "sl", { includeAuto: true }));
    container.querySelector("#tl").replaceWith(createLanguagePicker(shadow, "tl", { includeAuto: false }));
    setupEventListeners(iconCpy, iconCheck, iconStar, iconStarFilled);
  };

  const setupEventListeners = (iconCpy, iconCheck, iconStar, iconStarFilled) => {
    const slEl = container.querySelector("#sl");
    const tlEl = container.querySelector("#tl");
    const resEl = container.querySelector("#res");

    const fetchUpdate = () => {
      requestTranslation(originalText, slEl.value, tlEl.value, container);
    };

    // The original text is always shown, muted. Click it (or the pencil) to change it; Enter or clicking
    // away translates the new text, Escape puts the old text back. It never translates while you type:
    // Google refuses lookups that come close together.
    const srcEl = container.querySelector("#src");
    srcEl.textContent = originalText;
    const pageSentence = context; // what the page said around the original selection
    const startEdit = () => {
      if (srcEl.querySelector("textarea")) return;
      const area = document.createElement("textarea");
      area.className = "src-input";
      area.rows = 1;
      area.value = originalText;
      area.spellcheck = false;
      const fit = () => {
        area.style.height = "auto";
        // scrollHeight leaves out the border, which would leave a sliver that scrolls
        area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`;
      };
      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        const next = area.value.trim();
        srcEl.classList.remove("editing");
        if (commit && next && next !== originalText.trim()) {
          originalText = next;
          // The saved sentence only helps if it still contains the word. It is always chosen from what the
          // page said, so editing away from the word and back brings it back.
          context = pageSentence.toLowerCase().includes(next.toLowerCase()) ? pageSentence : "";
          srcEl.textContent = originalText;
          container.onresult?.(); // the star was for the old text
          fetchUpdate();
        } else {
          srcEl.textContent = originalText;
        }
      };
      area.addEventListener("input", fit);
      area.addEventListener("keydown", (e) => {
        e.stopPropagation(); // typing here must not trigger the page's own keyboard shortcuts
        if (e.isComposing) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      });
      for (const type of ["keyup", "keypress"]) area.addEventListener(type, (e) => e.stopPropagation());
      area.addEventListener("blur", () => finish(true));
      srcEl.classList.add("editing");
      srcEl.replaceChildren(area);
      fit();
      area.focus({ preventScroll: true });
      area.setSelectionRange(area.value.length, area.value.length);
    };
    srcEl.onclick = startEdit;
    container.querySelector("#src-edit").onclick = startEdit;

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

    container.querySelector("#vocab-btn").onclick = () => {
      chrome.runtime.sendMessage({ action: "openVocab" });
    };

    container.querySelector("#theme-btn").onclick = () => {
      const state = {
        sl: slEl.value,
        tl: tlEl.value,
        res: resEl.innerText,
        extra: Array.from(container.querySelector("#extra").childNodes),
      };
      isDark = !isDark;
      chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
      updateStyles();
      renderContent();
      container.querySelector("#sl").value = state.sl;
      container.querySelector("#tl").value = state.tl;
      container.querySelector("#res").innerText = state.res;
      container.querySelector("#extra").append(...state.extra);
      container.onresult(); // The star was checked before the language was restored
    };

    // Saved words live in storage.local (storage.sync is capped at 8KB per item)
    const starEl = container.querySelector("#star");
    const isSame = (v) =>
      v.text.toLowerCase() === originalText.toLowerCase() && v.tl === tlEl.value;
    const refreshStar = () => {
      chrome.storage.local.get({ vocab: [] }, ({ vocab }) => {
        const saved = vocab.some(isSame);
        starEl.classList.toggle("saved", saved);
        starEl.innerHTML = saved ? iconStarFilled : iconStar;
        starEl.title = saved ? "Remove from vocabulary" : "Save to vocabulary";
      });
    };
    starEl.onclick = () => {
      chrome.storage.local.get({ vocab: [] }, ({ vocab }) => {
        const rest = vocab.filter((v) => !isSame(v));
        if (rest.length === vocab.length) {
          if (!lastResult) return; // Nothing to save until a translation arrives
          rest.push({
            id: Date.now(),
            text: originalText,
            translation: lastResult,
            sl: lastDetected || slEl.value,
            tl: tlEl.value,
            context,
            savedAt: Date.now(),
          });
        }
        chrome.storage.local.set({ vocab: rest }, refreshStar);
      });
    };
    container.onresult = refreshStar; // requestTranslation calls this when a result arrives
    refreshStar();

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

    container.querySelector("#spk").onclick = async () => {
      stopSpeaking();
      if (!lastResult) return; // Still loading, or the translation failed
      const id = speakId;
      // A newer click, or closing the popup, makes this one stale
      const isStale = () => id !== speakId;
      try {
        await playGoogleSpeech(lastResult, tlEl.value, isStale);
      } catch (err) {
        // Google's audio was unreachable, or the page's security policy blocks audio
        if (isStale()) return;
        console.warn("[Swift Translate] Google voice failed:", err);
        // Say why, since the device voice may be missing or in the wrong language
        const extra = container.querySelector("#extra");
        extra.querySelector(".voice-note")?.remove();
        extra.append(el("div", "note voice-note", `Google voice failed (${err.message}). Using this device's voice.`));
        await speakWithBrowserVoice(lastResult, tlEl.value, isStale);
      }
    };
  };

  updateStyles();
  renderContent();
  shadow.appendChild(style);
  shadow.appendChild(container);
  document.body.appendChild(overlayHost);
  container.querySelector("#sl").value = initialSl;
  container.querySelector("#tl").value = initialTl;

  requestTranslation(originalText, initialSl, initialTl, container);
}

// Chrome fills in its voice list in stages: the first list can be empty, or hold only
// the basic system voices, and the better "Google"/"Natural" ones arrive later through
// "voiceschanged". Picking from the first list is what gave the poor default voice.
const isGoodVoice = (v) => /Google|Natural|Neural|Online/.test(v.name);
const voiceCache = new Map(); // language -> chosen voice, so only the first click per page can wait

function pickVoice(lang) {
  if (voiceCache.has(lang)) return Promise.resolve(voiceCache.get(lang));
  const synth = window.speechSynthesis;
  const matches = () => synth.getVoices().filter((v) => v.lang.startsWith(lang));
  return new Promise((resolve) => {
    let timer;
    const finish = () => {
      synth.removeEventListener("voiceschanged", onChange);
      clearTimeout(timer);
      const voice = matches().find(isGoodVoice) || matches()[0] || null;
      // Remember "no voice for this language" too, but only once the list has loaded
      if (voice || synth.getVoices().length) voiceCache.set(lang, voice);
      resolve(voice);
    };
    const onChange = () => {
      if (matches().some(isGoodVoice)) finish();
    };
    if (matches().some(isGoodVoice)) return finish();
    // Wait a little for a better voice, then settle for whatever exists
    synth.addEventListener("voiceschanged", onChange);
    timer = setTimeout(finish, 1500);
  });
}
window.speechSynthesis.getVoices(); // starts the voice list loading before the first click

async function speakWithBrowserVoice(text, lang, isStale) {
  const u = new SpeechSynthesisUtterance(text);
  const voice = await pickVoice(lang);
  if (isStale()) return;
  if (voice) u.voice = voice;
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

// Google's audio endpoint rejects long text, so read long results in pieces
function splitForSpeech(text, max = 180) {
  const sentences = text.match(/[^.!?؟。！？\n]+[.!?؟。！？]*\s*/g) || [text];
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length <= max) {
      current += sentence;
      continue;
    }
    if (current.trim()) chunks.push(current.trim());
    current = "";
    // A single sentence over the limit is cut at word boundaries
    let rest = sentence;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      const at = cut > 0 ? cut : max;
      chunks.push(rest.slice(0, at).trim());
      rest = rest.slice(at);
    }
    current = rest;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function playGoogleSpeech(text, lang, isStale) {
  const clips = await Promise.all(
    splitForSpeech(text).map(
      (chunk) =>
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: "fetchSpeech", text: chunk, lang }, (r) => {
            if (chrome.runtime.lastError || !r || r.error) {
              reject(new Error(`fetch: ${chrome.runtime.lastError?.message || r?.error || "no response"}`));
            } else resolve(r.dataUrl);
          });
        }),
    ),
  );
  // Web Audio plays from memory. An <audio> element loading a data: URL is blocked by
  // the media-src policy of many sites (Google, GitHub, ...), and Web Audio is not.
  audioContext ||= new AudioContext();
  try {
    await audioContext.resume();
    const buffers = await Promise.all(
      clips.map((dataUrl) => {
        const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
        return audioContext.decodeAudioData(bytes.buffer);
      }),
    );
    for (const buffer of buffers) {
      if (isStale()) return;
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      currentSource = source;
      await new Promise((resolve) => {
        source.onended = resolve;
        source.start();
      });
    }
  } catch (e) {
    throw new Error(`play: ${e.name}`);
  }
}

function stopSpeaking() {
  speakId++;
  window.speechSynthesis.cancel();
  if (currentSource) {
    currentSource.stop(); // Ends the pending clip, and the stale check ends the loop
    currentSource = null;
  }
}

// Only the latest request may write to the result box (avoids out-of-order responses)
let requestId = 0;
let speakId = 0;
let currentSource = null; // The audio clip playing now
let audioContext = null;
let lastResult = ""; // The translation on screen, empty while loading or after a failure
let lastDetected = ""; // Source language Google detected for lastResult
const translationCache = new Map(); // Repeat lookups skip Google, which rate-limits us
const CACHE_LIMIT = 100;

function requestTranslation(text, sl, tl, container) {
  const id = ++requestId;
  // Look these up each time: the theme toggle rebuilds the popup while requests are in flight
  const resEl = () => container.querySelector("#res");
  const extraEl = () => container.querySelector("#extra");
  const showGoogleResult = (r) => {
    lastResult = r.translated;
    lastDetected = r.detected || "";
    resEl().innerText = r.translated;
    renderExtra(extraEl(), r);
    if (container.onresult) container.onresult();
  };

  lastResult = "";
  lastDetected = "";
  extraEl().replaceChildren();
  const key = `${sl}|${tl}|${text}`;
  if (translationCache.has(key)) {
    showGoogleResult(translationCache.get(key));
    return;
  }
  resEl().innerText = "...";
  chrome.runtime.sendMessage(
    { action: "fetchTranslation", text, sl, tl },
    async (r) => {
      // lastError must be read before the first await
      const failed = chrome.runtime.lastError || !r || r.error || !r.translated;
      if (id !== requestId) return;
      if (!failed) {
        translationCache.set(key, r);
        if (translationCache.size > CACHE_LIMIT) {
          translationCache.delete(translationCache.keys().next().value);
        }
        showGoogleResult(r);
        return;
      }
      const offline = await translateOnDevice(text, sl, tl);
      if (id !== requestId) return;
      lastResult = offline || "";
      resEl().innerText =
        offline ||
        (r?.rateLimited
          ? "Google is limiting requests right now. Try again in about 30 seconds."
          : "Translation failed. Please try again.");
      if (offline) {
        extraEl().append(el("div", "note", "Translated on this device (Google was unavailable)"));
        if (container.onresult) container.onresult();
      }
    },
  );
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderExtra(extraEl, { romanized, dictionary }) {
  if (romanized) extraEl.append(el("div", "romanized", romanized));
  if (!dictionary || !dictionary.length) return;

  const dict = el("div", "dict");
  dictionary.forEach(({ pos, terms, definitions, synonyms }) => {
    if (pos) dict.append(el("div", "pos", pos));
    if (terms.length) dict.append(el("div", "", terms.join(", ")));
    if (definitions.length) {
      const list = el("ol");
      definitions.forEach(({ text, example }) => {
        const item = el("li", "", text);
        if (example) item.append(el("div", "def-example", `"${example}"`));
        list.append(item);
      });
      dict.append(list);
    }
    if (synonyms.length) dict.append(el("div", "synonyms", `Similar: ${synonyms.join(", ")}`));
  });

  // Hidden until asked for: the dictionary is long, and would stretch the popup every time.
  dict.hidden = true;
  const toggle = el("button", "dict-toggle", "See dictionary");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    dict.hidden = !dict.hidden;
    toggle.textContent = dict.hidden ? "See dictionary" : "Hide dictionary";
    toggle.setAttribute("aria-expanded", String(!dict.hidden));
  });
  extraEl.append(toggle, dict);
}

// Chrome's built-in on-device translator, used when Google can't be reached.
// Missing on older Chrome and on non-HTTPS pages, in which case this returns null.
// These calls can hang (seen with Translator.availability), so give up after 8s
// rather than leaving the popup on "..." forever.
function translateOnDevice(text, sl, tl) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
  return Promise.race([runOnDeviceTranslator(text, sl, tl), timeout]);
}

async function runOnDeviceTranslator(text, sl, tl) {
  const toLocal = (code) =>
    ({ "zh-CN": "zh", "zh-TW": "zh-Hant" })[code] || code;
  try {
    if (!("Translator" in self)) return null;
    let source = sl;
    if (sl === "auto") {
      if (!("LanguageDetector" in self)) return null;
      const detector = await LanguageDetector.create();
      const [best] = await detector.detect(text);
      detector.destroy();
      // A low-confidence guess would give a wrong translation that looks right
      if (!best || best.detectedLanguage === "und" || best.confidence < 0.5) return null;
      source = best.detectedLanguage;
    }
    const pair = { sourceLanguage: toLocal(source), targetLanguage: toLocal(tl) };
    if ((await Translator.availability(pair)) === "unavailable") return null;
    const translator = await Translator.create(pair);
    const translated = await translator.translate(text);
    translator.destroy();
    return translated;
  } catch {
    return null;
  }
}

function removeOverlay() {
  if (overlayHost) {
    stopSpeaking();
    overlayHost.remove();
    overlayHost = null;
  }
}
