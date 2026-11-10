// Makes the demo GIF for the README from the real extension on a real Wikipedia page: node demo.mjs
//
// It doesn't film in real time. It takes a picture after each small mouse move and sets how long each picture
// shows, so waits (for Google, and the pauses that keep us under its rate limit) don't cost any frames.
// The cursor is drawn into the page, because screenshots don't include the real one.
import fs from 'node:fs';
import path from 'node:path';
import { launch, configure } from './launch.mjs';
import { encodeGif } from './gif.mjs';
import { EN_ARTICLE, locate, openArticle, pace, waitForTranslation } from './helpers.mjs';

const OUT = path.resolve(import.meta.dirname, '..', 'assets', 'swift-translate.gif');
const VIEW = { width: 900, height: 560 };

const { context, worker, close } = await launch({ viewport: VIEW });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

// A cursor and a click ripple, drawn in the page, following the real mouse events.
await page.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px)';
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 3-8 8-3z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cursor);
    addEventListener('mousemove', (e) => (cursor.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`), true);
    addEventListener('mousedown', (e) => {
      const ring = document.createElement('div');
      ring.style.cssText = `position:fixed;left:${e.clientX - 16}px;top:${e.clientY - 16}px;width:32px;height:32px;border-radius:50%;border:3px solid rgba(26,115,232,.9);z-index:2147483646;pointer-events:none`;
      document.documentElement.appendChild(ring);
      setTimeout(() => ring.remove(), 220);
    }, true);
  });
});

const frames = [];
const snap = async (ms) => frames.push({ png: await page.screenshot({ type: 'png' }), ms });
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
let cursor = { x: 760, y: 470 };

/** Moves the mouse to a point in small steps, taking a picture of each. */
async function glide(to, { steps = 12, ms = 45 } = {}) {
  const from = cursor;
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await snap(ms);
  }
  cursor = to;
}
const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const iconCentre = async () => {
  const icon = page.locator('button[title="Translate"]');
  await icon.waitFor();
  const b = await icon.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const centreOf = async (selector) => {
  const b = await page.locator(selector).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

try {
  await configure(worker, { targetLang: 'fr', sourceLang: 'auto', theme: 'light' });
  await openArticle(page, EN_ARTICLE);
  // Text only: pictures and tables would use up the GIF's colours and size.
  // (Set on each element: the skin's own !important rules beat a style sheet.)
  await page.evaluate(() =>
    document.querySelectorAll('table, figure, .thumb').forEach((e) => e.style.setProperty('display', 'none', 'important')),
  );
  await page.mouse.move(cursor.x, cursor.y);

  // 1: a word, then the icon, then the popup with its dictionary
  const word = (await locate(page, 'perceive and comprehend language', 'comprehend', { top: 150 })).first;
  await snap(900);
  await glide(mid(word), { steps: 14 });
  await page.mouse.dblclick(mid(word).x, mid(word).y);
  await page.waitForTimeout(500);
  await snap(700);
  await glide(await iconCentre(), { steps: 7 });
  await pace(page);
  await page.mouse.down();
  await page.mouse.up();
  await snap(450); // "..." while Google answers
  await waitForTranslation(page);
  await snap(1400);
  // open the dictionary
  await glide(await centreOf('.dict-toggle'), { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  await snap(2200);
  // save it
  await glide(await centreOf('#star'), { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
  await snap(1400);

  // 2: close it, then a whole sentence into Arabic
  // the empty margin beside the article: a click inside the text could land on a link
  await glide({ x: 30, y: 300 }, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
  await snap(500);
  await configure(worker, { targetLang: 'ar' });
  const sentence = 'The capacity to successfully use language requires human beings to acquire a range of tools, including phonology, morphology, syntax, semantics, and an extensive vocabulary.';
  const { first, last } = await locate(page, sentence, sentence, { top: 120 });
  await glide({ x: first.x + 1, y: first.y + first.h / 2 }, { steps: 10 });
  await page.mouse.down();
  // drag along the sentence, a picture every few steps so the highlight visibly grows
  const rows = 14;
  for (let i = 1; i <= rows; i++) {
    const t = i / rows;
    const x = first.x + (last.x + last.w - first.x) * t;
    const y = first.y + first.h / 2 + (last.y - first.y) * t;
    await page.mouse.move(x, y);
    await snap(70);
  }
  await page.mouse.up();
  cursor = { x: last.x + last.w - 1, y: last.y + last.h / 2 };
  await page.waitForTimeout(500);
  await snap(500);
  await glide(await iconCentre(), { steps: 7 });
  await pace(page);
  await page.mouse.down();
  await page.mouse.up();
  await snap(450);
  await waitForTranslation(page);
  await snap(2800);

  // 3: dark mode
  await glide(await centreOf('#theme-btn'), { steps: 10 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
  await snap(2200);

  console.log(`${frames.length} pictures`);
  const bytes = encodeGif(frames);
  fs.writeFileSync(OUT, bytes);
  console.log(`${OUT}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
} finally {
  await close();
}
