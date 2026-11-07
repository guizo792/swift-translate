const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
let vocab = [];

const names = new Intl.DisplayNames(["en"], { type: "language" });
const langName = (code) => {
  try {
    return names.of(code);
  } catch {
    return code;
  }
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const shown = vocab
    .filter((v) => [v.text, v.translation, v.context].join(" ").toLowerCase().includes(query))
    .sort((a, b) => b.savedAt - a.savedAt);

  countEl.textContent = `${vocab.length} saved`;
  listEl.replaceChildren(
    ...shown.map((v) => {
      const card = el("div", "card");
      const main = el("div", "card-main");
      main.append(el("div", "word", v.text), el("div", "translation", v.translation));
      if (v.context) main.append(el("div", "context", `"${v.context}"`));
      const pair = v.sl && v.sl !== "auto" ? `${langName(v.sl)} → ${langName(v.tl)}` : langName(v.tl);
      main.append(el("div", "meta", `${pair} · ${new Date(v.savedAt).toLocaleDateString()}`));

      const remove = el("button", "remove", "Remove");
      remove.onclick = () => {
        vocab = vocab.filter((x) => x.id !== v.id);
        chrome.storage.local.set({ vocab });
      };
      card.append(main, remove);
      return card;
    }),
  );

  emptyEl.hidden = shown.length > 0;
  emptyEl.textContent = vocab.length
    ? "No saved words match your search."
    : "Nothing saved yet. Select a word on any page, translate it, and click the star.";
}

function exportCsv() {
  const cell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const rows = [["Word", "Translation", "Source", "Target", "Sentence", "Saved"]].concat(
    [...vocab]
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((v) => [v.text, v.translation, v.sl, v.tl, v.context, new Date(v.savedAt).toISOString()]),
  );
  // The BOM makes Excel read non-Latin text as UTF-8
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const link = el("a");
  link.href = URL.createObjectURL(blob);
  link.download = "swift-translate-vocabulary.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function load() {
  chrome.storage.local.get({ vocab: [] }, (data) => {
    vocab = data.vocab;
    render();
  });
}

chrome.storage.sync.get(
  { theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" },
  ({ theme }) => (document.documentElement.dataset.theme = theme),
);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.vocab) load();
});
searchEl.addEventListener("input", render);
document.getElementById("export").addEventListener("click", exportCsv);
load();
