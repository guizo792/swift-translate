// Makes the Chrome Web Store screenshots from the real extension on real Wikipedia pages
// (throwaway profile, headless): node screenshots.mjs
//
// Writes store/screenshots/*.png, 1280x800: a caption bar over a sharp crop of the real thing.
// Look at every image before uploading: the pages and the translations come from the live web.
import fs from 'node:fs';
import path from 'node:path';
import { launch, configure } from './launch.mjs';
import { frame, size } from './frame.mjs';
import { EN_ARTICLE, FR_ARTICLE, openArticle, openPopup, popupBox, selectText, selectWord } from './helpers.mjs';

const OUT = path.resolve(import.meta.dirname, 'screenshots');
const RAW = path.resolve(import.meta.dirname, '.frames');
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

const VIEW = { width: 1280, height: 900 };
// Captured at twice the pixel density, so zoomed crops stay sharp.
const { context, worker, extensionId, close } = await launch({ viewport: VIEW, deviceScaleFactor: 2 });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const log = (m) => console.log(m);

/** A 1280:700 window around some boxes, with room to breathe, kept inside the browser window. */
function cropAround(boxes, { pad = 50, minWidth = 640 } = {}) {
  const x0 = Math.min(...boxes.map((b) => b.x)) - pad;
  const y0 = Math.min(...boxes.map((b) => b.y)) - pad;
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
  const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
  let width = Math.min(VIEW.width, Math.max(x1 - x0, ((y1 - y0) * 1280) / 700, minWidth));
  const height = (width * 700) / 1280;
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  return {
    x: clamp((x0 + x1) / 2 - width / 2, VIEW.width - width),
    y: clamp((y0 + y1) / 2 - height / 2, VIEW.height - height),
    width,
    height,
  };
}

const toBox = (r) => ({ x: r.x, y: r.y, width: r.w, height: r.h });

async function make(file, title, clip, ring) {
  const raw = path.join(RAW, `${file}-raw.png`);
  await page.screenshot({ path: raw, clip, scale: 'device' });
  const scale = 1280 / clip.width;
  const out = path.join(OUT, file);
  await frame(context, {
    title,
    image: raw,
    output: out,
    ring: ring && {
      x: (ring.x - clip.x) * scale,
      y: (ring.y - clip.y) * scale,
      w: ring.w * scale,
      h: ring.h * scale,
      radius: ring.radius * scale,
    },
  });
  const [w, h] = size(out);
  if (w !== 1280 || h !== 800) throw new Error(`${file} is ${w}x${h}, not 1280x800`);
  log(file);
}

const saveWithStar = async () => {
  await page.locator('#star').click();
  await page.waitForTimeout(400);
};

try {
  // 1 and 2: English article, translated to French. The first word is saved, so the star is gold.
  await configure(worker, { targetLang: 'fr', sourceLang: 'auto', theme: 'light' });
  await openArticle(page, EN_ARTICLE);
  const word = await selectWord(page, 'perceive and comprehend language', 'comprehend');
  const icon = page.locator('button[title="Translate"]');
  await icon.waitFor();
  const iconBox = await icon.boundingBox();
  await make(
    '01-select.png',
    'Select text, tap the icon',
    cropAround([toBox({ ...word, x: word.x, y: word.y }), iconBox], { pad: 70 }),
    { x: iconBox.x + iconBox.width / 2, y: iconBox.y + iconBox.height / 2, w: iconBox.width + 18, h: iconBox.height + 18, radius: 14 },
  );
  await openPopup(page);
  await saveWithStar();
  await page.locator('.dict-toggle').click(); // the dictionary is hidden until asked for
  await page.waitForTimeout(300);
  await make('02-dictionary.png', 'Meanings, examples and similar words', cropAround([toBox(word), await popupBox(page)], { pad: 36 }));

  // Two more words for the saved-words page.
  for (const [context, target] of [
    // Plain words only: double-clicking a link would follow it.
    ['structures, rules, and representation', 'representation'],
    ['The capacity to successfully', 'capacity'],
  ]) {
    await openArticle(page, EN_ARTICLE);
    await selectWord(page, context, target);
    await openPopup(page);
    await saveWithStar();
  }

  // 3: a whole sentence into Arabic, with the romanization under it.
  await configure(worker, { targetLang: 'ar' });
  await openArticle(page, EN_ARTICLE);
  const sentence =
    'The capacity to successfully use language requires human beings to acquire a range of tools, including phonology, morphology, syntax, semantics, and an extensive vocabulary.';
  const { first, last } = await selectText(page, sentence);
  await openPopup(page);
  await make(
    '03-sentence.png',
    'Whole sentences, 80+ languages',
    cropAround([toBox(first), toBox(last), await popupBox(page)], { pad: 40 }),
  );

  await openArticle(page, EN_ARTICLE);
  await selectWord(page, 'and an extensive vocabulary', 'extensive');
  await openPopup(page);
  await saveWithStar();

  // 4: a French article into English, in dark mode.
  await configure(worker, { targetLang: 'en', theme: 'dark' });
  await openArticle(page, FR_ARTICLE);
  const french = await selectWord(page, 'à décrire et comprendre', 'décrire');
  await openPopup(page);
  await saveWithStar();
  await make('04-dark.png', 'Any language, light or dark', cropAround([toBox(french), await popupBox(page)], { pad: 40 }));

  // 5: the saved words, with the sentences they came from.
  await configure(worker, { theme: 'light' });
  await page.goto(`chrome-extension://${extensionId}/vocab.html`);
  await page.waitForSelector('.card');
  await page.waitForTimeout(300);
  await make('05-saved-words.png', 'Keep the words you learn', { x: 200, y: 30, width: 880, height: 481.25 });
} finally {
  await close();
}
