const input = document.getElementById("lang");
const list = document.getElementById("list");
const icon = document.getElementById("icon");
const languages = Object.entries(LANGUAGES).filter(([code]) => code !== "auto");
let current = "en";
let shown = [];
let active = 0;

// Names that start with the typed text come first, then names that contain it
function matches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return languages;
  const starts = [], contains = [];
  for (const entry of languages) {
    const name = entry[1].toLowerCase();
    if (name.startsWith(q) || entry[0].toLowerCase() === q) starts.push(entry);
    else if (name.includes(q)) contains.push(entry);
  }
  return [...starts, ...contains];
}

function render(query = "") {
  shown = matches(query);
  active = Math.max(0, shown.findIndex(([code]) => code === current));
  if (query.trim()) active = 0;
  list.replaceChildren();
  if (!shown.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No language found";
    list.append(li);
  }
  shown.forEach(([code, name], i) => {
    const li = document.createElement("li");
    li.textContent = name;
    if (i === active) li.className = "active";
    // mousedown, so the input doesn't lose focus (and close the list) first
    li.onmousedown = (e) => { e.preventDefault(); choose(code); };
    list.append(li);
  });
  list.hidden = false;
  list.querySelector(".active")?.scrollIntoView({ block: "nearest" });
}

function setActive(i) {
  list.children[active]?.classList.remove("active");
  active = i;
  list.children[active].classList.add("active");
  list.children[active].scrollIntoView({ block: "nearest" });
}

function choose(code) {
  current = code;
  chrome.storage.sync.set({ targetLang: code });
  input.value = LANGUAGES[code];
  list.hidden = true;
  input.blur();
}

input.onfocus = () => { input.select(); render(); };
input.onblur = () => { list.hidden = true; input.value = LANGUAGES[current]; };
input.oninput = () => render(input.value);
input.onkeydown = (e) => {
  if (e.key === "ArrowDown" && shown.length) { e.preventDefault(); setActive((active + 1) % shown.length); }
  else if (e.key === "ArrowUp" && shown.length) { e.preventDefault(); setActive((active - 1 + shown.length) % shown.length); }
  else if (e.key === "Enter" && shown[active]) { e.preventDefault(); choose(shown[active][0]); }
  else if (e.key === "Escape") { e.stopPropagation(); input.blur(); }
};

chrome.storage.sync.get(
  { targetLang: "en", showIcon: true, theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" },
  (data) => {
    current = LANGUAGES[data.targetLang] ? data.targetLang : "en";
    input.value = LANGUAGES[current];
    icon.checked = data.showIcon;
    document.documentElement.dataset.theme = data.theme;
  },
);

icon.onchange = () => chrome.storage.sync.set({ showIcon: icon.checked });
// Links in a popup open in a new tab, then the popup should close
document.getElementById("vocab").addEventListener("click", () => setTimeout(close, 50));

// How many words are saved
chrome.storage.local.get({ vocab: [] }, ({ vocab }) => {
  document.getElementById("count").textContent = vocab.length ? String(vocab.length) : "";
});
